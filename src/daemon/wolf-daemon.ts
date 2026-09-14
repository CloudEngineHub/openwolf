import {updateState,installedVersion} from '../hooks/runtime-updates.js';
import {activityState,receiptText,visibilityMode} from '../hooks/visibility.js';
import { Worker } from "node:worker_threads";
import { sharedWolfDir } from "../hooks/knowledge-root.js";
import { projectIdentity } from "../utils/project-identity.js";
import { startSourceWatcher } from "./source-watcher.js";
import { archiveMemory, restoreMemory } from "../hooks/memory-archive.js";
import { reconcileUsage } from "../tracker/usage-report.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { findProjectRoot } from "../scanner/project-root.js";
import { readJSON, writeJSON, readText } from "../utils/fs-safe.js";
import { getHealth } from "./health.js";
import { auditContextHealth } from "./context-audit.js";
import { withFileLock, mutateJSON } from "../hooks/anatomy-lock.js";
import { Logger } from "../utils/logger.js";
import { getDashboardToken, validateDashboardToken } from "../utils/dashboard-auth.js";
import { CronEngine, CronTaskNotFoundError } from "./cron-engine.js";
import { startFileWatcher } from "./file-watcher.js";
import { writeDaemonPidFile, removeDaemonPidFile } from "../utils/daemon-pidfile.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer explicit OPENWOLF_PROJECT_ROOT env (set by CLI commands) over cwd detection
// Resolve Windows 8.3 aliases before fs.watch: libuv can abort on short/long
// path mismatches (https://github.com/libuv/libuv/issues/5010).
const projectRoot = fs.realpathSync.native(process.env.OPENWOLF_PROJECT_ROOT || findProjectRoot());
const wolfDir = path.join(projectRoot, ".wolf");

interface WolfConfig {
  openwolf: {
    daemon: { port: number; log_level: string };
    dashboard: { enabled: boolean; port: number; host?: string };
    cron: { enabled: boolean; heartbeat_interval_minutes: number };
  };
}

const loadedConfig = readJSON<WolfConfig | null>(path.join(wolfDir,"config.json"),null);
const config: WolfConfig = {openwolf:{
  daemon:{port:18790,log_level:"info",...loadedConfig?.openwolf?.daemon},
  dashboard:{enabled:true,port:18791,...loadedConfig?.openwolf?.dashboard},
  cron:{enabled:true,heartbeat_interval_minutes:30,...loadedConfig?.openwolf?.cron},
}};

const logger = new Logger(
  path.join(wolfDir, "daemon.log"),
  config.openwolf.daemon.log_level as "debug" | "info" | "warn" | "error"
);

const startTime = Date.now();
const wsClients = new Set<WebSocket>();
getDashboardToken(wolfDir);

// Express server
const app = express();
app.use(express.json());

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

function extractBearerToken(req: Request): string | null {
  const auth = req.header("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  const queryToken = req.query.token;
  return typeof queryToken === "string" ? queryToken : null;
}

function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAllowedOrigin(req.header("origin"))) {
    res.status(403).json({ error: "Forbidden origin" });
    return;
  }
  if (!validateDashboardToken(wolfDir, extractBearerToken(req))) {
    res.status(401).json({ error: "Dashboard token required" });
    return;
  }
  next();
}

// Serve dashboard static files
// In dist: dist/src/daemon/wolf-daemon.js → ../../../dist/dashboard/
const dashboardDir = path.resolve(__dirname, "..", "..", "..", "dist", "dashboard");
if (config.openwolf.dashboard.enabled && fs.existsSync(dashboardDir)) {
  app.use(express.static(dashboardDir));
}

// Detect project metadata
function detectProjectMeta(): { name: string; description: string } {
  let name = path.basename(projectRoot);
  let description = "";

  // Try package.json
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
    if (pkg.name) name = pkg.name;
    if (pkg.description) description = pkg.description;
  } catch {}

  // Try Cargo.toml for name if not found
  if (name === path.basename(projectRoot)) {
    try {
      const cargo = fs.readFileSync(path.join(projectRoot, "Cargo.toml"), "utf-8");
      const nameMatch = cargo.match(/^name\s*=\s*"([^"]+)"/m);
      if (nameMatch) name = nameMatch[1];
    } catch {}
  }

  // If no description, try cerebrum.md project description
  if (!description) {
    try {
      const cerebrum = fs.readFileSync(path.join(wolfDir, "cerebrum.md"), "utf-8");
      const descMatch = cerebrum.match(/\*\*Project:\*\*\s*(.+)/);
      if (descMatch) description = descMatch[1].trim();
    } catch {}
  }

  // If still no description, try README first paragraph
  if (!description) {
    for (const readme of ["README.md", "readme.md", "README.rst"]) {
      try {
        const content = fs.readFileSync(path.join(projectRoot, readme), "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("!") && !trimmed.startsWith("=") && !trimmed.startsWith("-") && !trimmed.startsWith("<") && !trimmed.startsWith("[") && !trimmed.startsWith("```") && trimmed.length > 10) {
            description = trimmed.length > 200 ? trimmed.slice(0, 200) + "…" : trimmed;
            break;
          }
        }
        if (description) break;
      } catch {}
    }
  }

  return { name, description };
}

const projectMeta = detectProjectMeta();

// API routes
app.use("/api", requireDashboardAuth);

app.get("/api/health", (_req, res) => {
  // getHealth computes real degraded/unhealthy states from the dead-letter
  // queue; the route used to hardcode "healthy" regardless.
  res.json(getHealth(wolfDir, startTime));
});

app.get("/api/activity", (_req,res)=>{
  const {state}=activityState(projectRoot);
  res.json({mode:visibilityMode(projectRoot),history:state.history.map(r=>({...r,text:receiptText(r)})),counts:state.counts,updates:{...updateState(projectRoot),installed:installedVersion(projectRoot)},diagnostics:["Local receipts only; no model requests. Fixed-size spool may drop activity during bursts; operational data is unaffected.","History: latest 100 actions. Persistent bounded deduplication favors silence on hash collisions; counters cover recorded actions only.","Claude: status-line segment, custom commands preserved. Codex: recovery notices. OpenCode: informational toasts. Grok/headless: dashboard history."]});
});

app.get("/api/project", (_req, res) => {
  res.json({
    name: projectMeta.name,
    description: projectMeta.description,
    root: projectRoot,
    identity: projectIdentity(projectRoot),
  });
});

app.get("/api/files", (_req, res) => {
  const files: Record<string, string> = {};
  const wolfFiles = [
    "OPENWOLF.md", "identity.md", "cerebrum.md", "memory.md", "anatomy.md",
    "config.json", "token-ledger.json", "buglog.json",
    "cron-manifest.json", "cron-state.json", "STATUS.md", "_scan-state.json", "anatomy-index.json",
    "hooks/_heartbeat.json", "usage-report.json",
  ];
  for (const file of wolfFiles) {
    try {
      files[file] = fs.readFileSync(path.join(file === "buglog.json" ? sharedWolfDir(wolfDir) : wolfDir, file), "utf-8");
    } catch {
      files[file] = "";
    }
  }
  res.json(files);
});

// Reconcile current harness records on a bounded cadence; every UI uses this report.
let usageCache: ReturnType<typeof reconcileUsage> | null = null;
let usageCacheAt = 0;
let usageInFlight: Promise<ReturnType<typeof reconcileUsage>> | null = null;
function refreshUsage() {
  if (!usageInFlight) usageInFlight = new Promise<ReturnType<typeof reconcileUsage>>((resolve,reject)=>{
    const worker = new Worker(new URL("../tracker/usage-worker.js",import.meta.url),{workerData:{root:projectRoot}});
    let received=false;
    worker.once("message",message=>{
      received=true;
      if (message.error) reject(new Error(message.error));
      else {usageCache=message.report;usageCacheAt=Date.now();resolve(message.report);}
    });
    worker.once("error",reject);
    worker.once("exit",code=>{if (!received) reject(new Error(`Usage worker exited ${code}`));});
  }).finally(()=>{usageInFlight=null;});
  return usageInFlight;
}
app.get("/api/usage", async (_req, res) => {
  try {
    if (!usageCache || Date.now() - usageCacheAt > 15000) await refreshUsage();
    res.json(usageCache);
  } catch (error) { res.status(500).json({error: String(error)}); }
});

app.get("/api/memory/archive/:id", (req,res)=>{
  const id=String(req.params.id);
  if (!/^[a-f0-9]{64}$/.test(id)) {res.status(400).json({error:"Invalid archive ID"});return;}
  try {res.json({id,content:fs.readFileSync(path.join(wolfDir,"archive","memory",id+".md"),"utf8")});}
  catch {res.status(404).json({error:"Archive not found"});}
});
app.post("/api/memory/restore/:id", (req,res)=>{
  try {restoreMemory(wolfDir,String(req.params.id));usageCacheAt=0;res.json({status:"restored"});}
  catch(error) {res.status(400).json({error:String(error)});}
});

// Context-health audit (J3): read-only checks on always-on context cost.
// Expensive history/Git work runs off the daemon's event loop.
let handoverWorkers=0;
async function handoverJob(action:string,args:unknown={}) {
  if(handoverWorkers>=2)throw new Error("Handover is busy; retry shortly");
  handoverWorkers++;
  try{return await new Promise<any>((resolve,reject)=>{
    const worker=new Worker(new URL("../handoff/worker.js",import.meta.url),{workerData:{root:projectRoot,action,args}});
    const timer=setTimeout(()=>{void worker.terminate();reject(new Error("Handover operation timed out"))},30000);
    let received=false;
    worker.once("message",message=>{received=true;clearTimeout(timer);message.error?reject(new Error(message.error)):resolve(message.result)});
    worker.once("error",error=>{clearTimeout(timer);reject(error)});
    worker.once("exit",code=>{clearTimeout(timer);if(!received)reject(new Error(`Handover worker exited ${code}`))});
  })}finally{handoverWorkers--}
}
app.get("/api/handoff",async (_req,res)=>{try{res.json(await handoverJob("summary"))}catch(e){res.status(400).json({error:String(e)})}});
app.get("/api/handoff/sessions",async (req,res)=>{try{res.json(await handoverJob("sessions",{agent:req.query.agent}))}catch(e){res.status(400).json({error:String(e)})}});
app.get("/api/handoff/packet/:id",async (req,res)=>{try{res.json(await handoverJob("inspect",{id:req.params.id}))}catch(e){res.status(400).json({error:String(e)})}});
app.get("/api/handoff/search",async (req,res)=>{try{res.json(await handoverJob("search",{query:req.query.q}))}catch(e){res.status(400).json({error:String(e)})}});
for(const action of ["export","import","checkpoint","recover"]){
  app.post(`/api/handoff/${action}`,async(req,res)=>{try{res.json(await handoverJob(action,req.body));usageCacheAt=0}catch(e){res.status(400).json({error:String(e)})}});
}

app.get("/api/context-health", (_req, res) => {
  try {
    res.json(auditContextHealth(projectRoot, wolfDir));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Trigger a cron task by ID
app.post("/api/cron/run/:taskId", (req, res) => {
  const { taskId } = req.params;
  if (!cronEngine) {
    res.status(503).json({ error: "Cron engine not running" });
    return;
  }
  cronEngine.runTask(taskId).then(() => {
    res.json({ status: "ok", task_id: taskId });
  }).catch((err) => {
    // An unknown id is a client error, not a server failure, and definitely
    // not a success (#87).
    if (err instanceof CronTaskNotFoundError) {
      res.status(404).json({ error: err.message, task_id: taskId, known_tasks: err.knownTaskIds });
      return;
    }
    res.status(500).json({ error: String(err) });
  });
});

// SPA fallback
app.get("/{*path}", (_req, res) => {
  const indexPath = path.join(dashboardDir, "index.html");
  if (config.openwolf.dashboard.enabled && fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: "Dashboard not built. Run: pnpm build:dashboard" });
  }
});

// Start HTTP server. OPENWOLF_DASHBOARD_PORT lets the launcher override the
// configured port when it is already held by another project's daemon.
const envPort = Number(process.env.OPENWOLF_DASHBOARD_PORT);
const selectedPort = config.openwolf.dashboard.enabled ? config.openwolf.dashboard.port : config.openwolf.daemon.port;
const port = Number.isInteger(envPort) && envPort > 0 && envPort <= 65535 ? envPort : Number.isInteger(selectedPort) && selectedPort > 0 && selectedPort <= 65535 ? selectedPort : 18791;
const host = config.openwolf.dashboard.host || "127.0.0.1";
const server = app.listen(port, host, () => {
  logger.info(`Dashboard server listening on ${host}:${port}`);
  // Written only after a successful bind: this file is what `daemon stop`
  // uses to prove a process is ours before signalling it, so it must never
  // claim a daemon that failed to start.
  writeDaemonPidFile(wolfDir, projectRoot, port);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  // Without this handler a bind race (EADDRINUSE between the launcher's port
  // probe and our listen) is an uncaught exception that kills the daemon
  // silently under stdio:"ignore".
  logger.error(`Dashboard server failed to bind ${host}:${port}: ${err.code ?? err.message}`);
  process.exit(1);
});

// WebSocket server
const wss = new WebSocketServer({
  server,
  verifyClient: (info, done) => {
    if (!isAllowedOrigin(info.origin)) {
      done(false, 403, "Forbidden origin");
      return;
    }
    try {
      const url = new URL(info.req.url ?? "", `http://${info.req.headers.host ?? "localhost"}`);
      if (!validateDashboardToken(wolfDir, url.searchParams.get("token"))) {
        done(false, 401, "Dashboard token required");
        return;
      }
    } catch {
      done(false, 401, "Dashboard token required");
      return;
    }
    done(true);
  },
});

wss.on("connection", (ws) => {
  wsClients.add(ws);
  logger.info("WebSocket client connected");

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as { type: string; task_id?: string };
      handleDashboardCommand(msg);
    } catch {
      logger.warn("Invalid WebSocket message received");
    }
  });

  ws.on("close", () => {
    wsClients.delete(ws);
  });

  // Send initial state
  broadcast({ type: "daemon_started", timestamp: new Date().toISOString() });
});

function broadcast(msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function handleDashboardCommand(msg: { type: string; task_id?: string }): void {
  switch (msg.type) {
    case "trigger_task":
      if (msg.task_id && cronEngine) {
        cronEngine.runTask(msg.task_id).catch((err) => {
          logger.error(`Manual task trigger failed: ${err}`);
        });
      }
      break;
    case "retry_dead_letter":
      if (msg.task_id) {
        const statePath = path.join(wolfDir, "cron-state.json");
        withFileLock(statePath + ".lock", 2000, () => {
          const state = readJSON<{ dead_letter_queue: Array<{ task_id: string }> }>(statePath, {
            dead_letter_queue: [],
          });
          state.dead_letter_queue = state.dead_letter_queue.filter(
            (d) => d.task_id !== msg.task_id
          );
          writeJSON(statePath, state);
        });
      }
      break;
    case "force_scan":
      if (cronEngine) {
        cronEngine.runTask("anatomy-rescan").catch((err) => {
          logger.error(`Force scan failed: ${err}`);
        });
      }
      break;
    case "request_full_state":
      // Send all files
      try {
        const files: Record<string, string> = {};
        const wolfFiles = [
          "OPENWOLF.md", "identity.md", "cerebrum.md", "memory.md", "anatomy.md",
          "config.json", "token-ledger.json", "buglog.json",
          "cron-manifest.json", "cron-state.json", "STATUS.md", "_scan-state.json", "anatomy-index.json",
        ];
        for (const file of wolfFiles) {
          try {
            files[file] = fs.readFileSync(path.join(file === "buglog.json" ? sharedWolfDir(wolfDir) : wolfDir, file), "utf-8");
          } catch {
            files[file] = "";
          }
        }
        broadcast({ type: "full_state", files, timestamp: new Date().toISOString() });
      } catch (err) {
        logger.error(`Full state request failed: ${err}`);
      }
      break;
  }
}

// Cron engine
let cronEngine: CronEngine | null = null;
if (config.openwolf.cron.enabled) {
  cronEngine = new CronEngine(wolfDir, projectRoot, logger, broadcast);
  cronEngine.start();
}

// File watcher
startFileWatcher(wolfDir, logger, broadcast);
const sourceWatcher = startSourceWatcher(projectRoot,wolfDir,logger);
try { archiveMemory(wolfDir,7); } catch(e) { logger.warn(`Memory maintenance deferred: ${e}`); }

// Health heartbeat
const minutes = config.openwolf.cron.heartbeat_interval_minutes;
const heartbeatInterval = (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60000;
const heartbeatTimer = setInterval(() => {
  const statePath = path.join(wolfDir, "cron-state.json");
  mutateJSON<Record<string, unknown>>(statePath, {}, 2000, (state) => {
    state.last_heartbeat = new Date().toISOString();
  });
  broadcast({ type: "health", status: getHealth(wolfDir,startTime).status, uptime: Math.floor((Date.now() - startTime) / 1000) });
}, heartbeatInterval);

// Update cron-state to running
const cronStatePath = path.join(wolfDir, "cron-state.json");
mutateJSON<Record<string, unknown>>(cronStatePath, {}, 2000, (cronState) => {
  cronState.engine_status = cronEngine ? "running" : "disabled";
  cronState.last_heartbeat = new Date().toISOString();
});

logger.info("OpenWolf daemon started");

// Graceful shutdown
function shutdown(): void {
  logger.info("Daemon shutting down...");
  removeDaemonPidFile(wolfDir);
  broadcast({ type: "daemon_stopping", timestamp: new Date().toISOString() });

  clearInterval(heartbeatTimer);
  void sourceWatcher.close();
  if (cronEngine) cronEngine.stop();

  // Locked like every other cron-state writer: this one ran unlocked and
  // could clobber a concurrent heartbeat or execution-log entry (#86).
  mutateJSON<Record<string, unknown>>(cronStatePath, {}, 2000, (state) => {
    state.engine_status = "stopped";
  });

  for (const client of wsClients) {
    client.close();
  }
  wsClients.clear();

  server.close(() => {
    logger.info("Daemon stopped");
    process.exit(0);
  });

  // Force exit after 5s
  setTimeout(() => process.exit(0), 5000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

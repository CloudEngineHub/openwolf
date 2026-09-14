// Exercise the actual packed npm CLI in disposable projects, including a real 2.5.1 upgrade.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import net from 'node:net';
import {execFileSync,spawn} from 'node:child_process';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const source=path.resolve(import.meta.dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'openwolf-release-'));
const npm=(args,cwd=temp)=>execFileSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd,encoding:'utf8',shell:process.platform==='win32',env:{...process.env,npm_config_cache:path.join(temp,'npm-cache')},maxBuffer:8*1024*1024});
const log=[];let child;
const fixtureHome=path.join(temp,'fixture-home'),bin=path.join(temp,'bin');fs.mkdirSync(fixtureHome);fs.mkdirSync(bin);
const preload=path.join(temp,'isolate.mjs');
// Process-local test seam: never change HOME/CODEX_HOME or the user's registry/PM2 instance.
fs.writeFileSync(preload,`import os from 'node:os';import {syncBuiltinESMExports} from 'node:module';os.homedir=()=>${JSON.stringify(fixtureHome)};syncBuiltinESMExports();`);
if(process.platform!=='win32')fs.symlinkSync(process.execPath,path.join(bin,'node'));
const env={...process.env,NODE_OPTIONS:`--import=${pathToFileURL(preload).href}`,OPENWOLF_NO_UPDATE:'1',CLAUDE_CONFIG_DIR:path.join(fixtureHome,'.claude'),PM2_HOME:path.join(fixtureHome,'.pm2')};
// Prevent auto-starting a globally installed PM2; daemon tests below own their exact child process.
if(process.platform!=='win32')env.PATH=bin+':/usr/bin:/bin';
const run=(cli,args,cwd)=>execFileSync(process.execPath,[cli,...args],{cwd,env,encoding:'utf8',maxBuffer:8*1024*1024});
const initGit=root=>{fs.mkdirSync(root,{recursive:true});execFileSync('git',['init','-q'],{cwd:root});fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:path.basename(root),version:'1.0.0'}));fs.writeFileSync(path.join(root,'app.js'),'export const answer = 42;\n');};
try{
 const packed=JSON.parse(npm(['pack','--json','--pack-destination',temp],source))[0];const tarball=path.join(temp,packed.filename);
 const install=path.join(temp,'install');npm(['install','--prefix',install,'--ignore-scripts','--no-audit','--no-fund',tarball]);
 const cli=path.join(install,'node_modules/openwolf/dist/bin/openwolf.js');assert.equal(run(cli,['--version'],temp).trim(),'2.5.2');
 const clean=path.join(temp,'clean');initGit(clean);run(cli,['init','--agent','claude','codex','opencode','grok'],clean);
 const wolf=path.join(clean,'.wolf');
 for(const f of ['visibility.js','visibility-statusline.js','handoff-state.js','update-worker.js'])assert(fs.existsSync(path.join(wolf,'hooks',f)),f);
 assert.equal(JSON.parse(fs.readFileSync(path.join(wolf,'hooks/runtime.json'))).version,'2.5.2');
 assert(fs.existsSync(path.join(clean,'.opencode/plugin/openwolf/visibility.ts')));assert(!fs.existsSync(path.join(clean,'.grok/hooks')));
 assert(fs.readFileSync(path.join(wolf,'.gitignore'),'utf8').includes('activity/'));log.push('Clean tarball installation: Claude/Codex/OpenCode helpers and Grok compatibility present');
 const oldInstall=path.join(temp,'old-install');npm(['install','--prefix',oldInstall,'--ignore-scripts','--no-audit','--no-fund','openwolf@2.5.1']);
 const oldCli=path.join(oldInstall,'node_modules/openwolf/dist/bin/openwolf.js'),upgrade=path.join(temp,'upgrade');initGit(upgrade);run(oldCli,['init','--agent','claude','codex','opencode'],upgrade);
 const oldWolf=path.join(upgrade,'.wolf'),settings=path.join(upgrade,'.claude/settings.json');const custom=JSON.parse(fs.readFileSync(settings));custom.statusLine={type:'command',command:'echo custom-status'};fs.writeFileSync(settings,JSON.stringify(custom));
 const memory='## Session: 2026-09-15\n\nUser memory survives upgrade.\n';fs.writeFileSync(path.join(oldWolf,'memory.md'),memory);
 const updateOutput=run(cli,['update','--project',upgrade],upgrade);assert(!updateOutput.includes('✗ Errors'),updateOutput);
 assert.equal(JSON.parse(fs.readFileSync(path.join(oldWolf,'hooks/runtime.json'))).version,'2.5.2');assert.equal(fs.readFileSync(path.join(oldWolf,'memory.md'),'utf8'),memory);
 assert.equal(JSON.parse(fs.readFileSync(settings)).statusLine.command,'echo custom-status');
 assert(fs.existsSync(path.join(upgrade,'.opencode/plugin/openwolf/visibility.ts')));log.push('Published 2.5.1 → packed 2.5.2 upgrade: memory/custom status preserved and plugin helpers refreshed');
 const checkFile=path.join(temp,'checkpoint.json');fs.writeFileSync(checkFile,JSON.stringify({objective:'Release fixture',next_action:'Verify activity API'}));
 run(cli,['handoff','checkpoint','--agent','codex','--session','release-fixture','--file',checkFile],upgrade);
 const listen=net.createServer();await new Promise(r=>listen.listen(0,'127.0.0.1',r));const port=listen.address().port;await new Promise(r=>listen.close(r));
 const configPath=path.join(oldWolf,'config.json'),config=JSON.parse(fs.readFileSync(configPath));config.openwolf.dashboard.port=port;config.openwolf.cron.enabled=false;config.openwolf.updates={mode:'off'};fs.writeFileSync(configPath,JSON.stringify(config));
 const daemon=path.join(install,'node_modules/openwolf/dist/src/daemon/wolf-daemon.js');
 const start=async()=>{
  let output='',startupError,lastResponse='No HTTP response';
  child=spawn(process.execPath,[daemon],{cwd:upgrade,env:{...env,OPENWOLF_PROJECT_ROOT:upgrade},stdio:['ignore','pipe','pipe']});
  child.once('error',error=>{startupError=error});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-8192)});
  const deadline=Date.now()+30_000;
  while(Date.now()<deadline){
   if(startupError||child.exitCode!==null||child.signalCode!==null)break;
   try{const token=fs.readFileSync(path.join(oldWolf,'dashboard-token'),'utf8').trim();const res=await fetch(`http://127.0.0.1:${port}/api/activity`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(1000)});if(res.ok)return {token,data:await res.json()};lastResponse='HTTP '+res.status}catch(error){lastResponse=error.message}
   await new Promise(r=>setTimeout(r,100));
  }
  throw Error(`Daemon failed readiness (exit=${child.exitCode}, signal=${child.signalCode}): ${startupError??lastResponse}\n${output}`);
 };
 const stop=async()=>{if(!child||child.exitCode!==null||child.signalCode!==null)return;const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited;child=undefined};
 const first=await start();assert(first.data.counts['checkpoint-saved']>=1);assert.equal(first.data.updates.installed,'2.5.2');assert.equal((await fetch(`http://127.0.0.1:${port}/api/activity`)).status,401);
 const project=await fetch(`http://127.0.0.1:${port}/api/project`,{headers:{Authorization:'Bearer '+first.token}});assert(project.ok);assert.equal((await project.json()).root,fs.realpathSync.native(upgrade));await stop();
 const second=await start();assert.equal(second.data.counts['checkpoint-saved'],first.data.counts['checkpoint-saved']);await stop();log.push('Authenticated dashboard, persistent activity and daemon restart verified');
 console.log(JSON.stringify({version:packed.version,files:packed.files.length,checks:log,temp},null,2));
 if(process.env.OPENWOLF_KEEP_RELEASE_FIXTURE)fs.writeFileSync(process.env.OPENWOLF_KEEP_RELEASE_FIXTURE,JSON.stringify({temp,clean,upgrade,cli,oldCli,tarball,preload},null,2));
}finally{
 if(child&&child.exitCode===null&&child.signalCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited}
 if(!process.env.OPENWOLF_KEEP_RELEASE_FIXTURE)fs.rmSync(temp,{recursive:true,force:true});
}

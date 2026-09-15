import * as path from 'node:path';
import {execFileSync} from 'node:child_process';
import {watch} from 'chokidar';
import {scanProject} from '../scanner/anatomy-scanner.js';
import type {Logger} from '../utils/logger.js';

/** Files edited outside the agent, additions and git worktree HEAD changes
 * invalidate anatomy too. At most one scan runs; events during it request another.
 */
export function startSourceWatcher(root: string, wolfDir: string, logger: Logger) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running=false, dirty=false, closed=false;
  const drain = async () => {
    if (running || closed) return;
    running=true; dirty=false;
    try {await scanProject(wolfDir,root);} catch(e) {logger.warn(`Anatomy refresh failed: ${e}`);}
    finally {running=false;if (dirty && !closed) schedule();}
  };
  const schedule = () => {dirty=true;clearTimeout(timer);timer=setTimeout(()=>void drain(),750);};
  const excluded = new Set(['.wolf','.git','node_modules','.venv','venv','dist','build','.next','.claude','.codex','.opencode','.agents']);
  const source=watch(root,{ignoreInitial:true,ignored:(p)=>path.relative(root,p).split(path.sep).some(part=>excluded.has(part)),awaitWriteFinish:{stabilityThreshold:300,pollInterval:100}});
  source.on('all',schedule);
  let git: ReturnType<typeof watch> | undefined;
  try {
    const gitDir=execFileSync('git',['rev-parse','--absolute-git-dir'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000}).trim();
    git=watch([path.join(gitDir,'HEAD'),path.join(gitDir,'index'),path.join(gitDir,'refs')],{ignoreInitial:true});
    git.on('all',schedule);
  } catch {}
  schedule(); // startup catch-up after the daemon was offline
  return {close:async()=>{closed=true;clearTimeout(timer);await source.close();await git?.close();}};
}

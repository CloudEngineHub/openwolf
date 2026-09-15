import {recordReceipt} from './visibility.js';
/** Network/install work lives in a detached worker, never on the tool path. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {RUNTIME_PROTOCOL, CHECK_INTERVAL, stableVersion, newer, compatible, updateState, updatePolicy, installedVersion, updatesDir, atomicObject, readObject, releasePackage, readyRelease, type UpdateState} from './runtime-updates.js';
const exec=promisify(execFile);
const REGISTRY='https://registry.npmjs.org';
export interface UpdateIO {
  metadata():Promise<any>;
  install(version:string,directory:string):Promise<void>;
  verify(pkg:string):Promise<void>;
}
const production:UpdateIO={
  async metadata(){const r=await fetch(REGISTRY+'/openwolf/latest',{signal:AbortSignal.timeout(8000),redirect:'error'});if(!r.ok)throw Error('npm registry unavailable');const body=await r.text();if(body.length>1_000_000)throw Error('Oversized registry response');return JSON.parse(body)},
  async install(version,directory){
    // Invoke npm's JS entry with Node, avoiding cmd/shell argument interpolation.
    const nodeDir=path.dirname(process.execPath);
    const candidates=[path.join(nodeDir,'node_modules/npm/bin/npm-cli.js'),path.resolve(nodeDir,'../lib/node_modules/npm/bin/npm-cli.js')];
    const npm=candidates.find(f=>fs.existsSync(f));if(!npm)throw Error('npm CLI not found next to Node; retained installed runtime');
    await exec(process.execPath,[npm,'install',`openwolf@${version}`,'--prefix',directory,'--registry',REGISTRY,'--ignore-scripts','--engine-strict','--no-audit','--no-fund','--package-lock=false','--save=false','--fetch-retries=0','--fetch-timeout=15000'],{cwd:directory,timeout:120_000,maxBuffer:512_000,windowsHide:true});
  },
  async verify(pkg){
    const meta=readObject(path.join(pkg,'package.json'));
    if(meta.name!=='openwolf'||meta.openwolfRuntime?.protocol!==RUNTIME_PROTOCOL)throw Error('Release does not support session-pinned runtime updates');
    for(const name of ['session-start','user-prompt-submit','pre-read','pre-write','pre-bash','post-read','post-write','post-bash','post-batch','precompact','stop','session-end']) {
      const r=await exec(process.execPath,[path.join(pkg,'dist','hooks',name+'.js'),'--selfcheck'],{timeout:5000,maxBuffer:8192,windowsHide:true});
      if(!r.stdout.includes('ok '+name))throw Error('Release hook selfcheck failed');
    }
    if(!fs.existsSync(path.join(pkg,'src/templates/opencode-plugin/index.ts')))throw Error('Release plugin missing');
  }
};
export async function checkForUpdate(root:string,force=false,io:UpdateIO=production):Promise<UpdateState> {
  const mode=updatePolicy(root),dir=updatesDir(root),file=path.join(dir,'state.json');
  if(mode==='off')return updateState(root);
  if(!stableVersion(installedVersion(root)))return {status:'unsupported',detail:'Initialize this project with the update-capable bootstrap first'};
  fs.mkdirSync(dir,{recursive:true});
  // An ownership lock is held until the entire asynchronous operation finishes.
  let release:(()=>void)|undefined;
  const lock=path.join(dir,'worker.lock');
  const {acquireLock}=await import('./anatomy-lock.js');
  release=acquireLock(lock,0) ?? undefined;
  if(!release)return updateState(root);
  let state=updateState(root);
  try {
    if(!force&&typeof state.checkedAt==='number'&&Date.now()-state.checkedAt<CHECK_INTERVAL)return state;
    const base=installedVersion(root);
    const current=stableVersion(state.selected)&&newer(state.selected,base)&&readyRelease(root,state.selected)?state.selected:base;
    if(stableVersion(state.selected)&&!newer(state.selected,base)){delete state.selected;delete state.previous;}
    if(!stableVersion(current))throw Error('Installed runtime version is unavailable');
    state={...state,checkedAt:Date.now()};atomicObject(file,state);
    const meta=await io.metadata();
    if(meta.name!=='openwolf'||!stableVersion(meta.version))throw Error('Invalid npm release metadata');
    state.latest=meta.version;
    if(!newer(meta.version,current)){state.status='current';delete state.detail;return state}
    if(mode==='notify'||(mode==='compatible'&&!compatible(meta.version,current))){state.status='available';state.detail='Release is outside automatic update policy';return state}
    if(meta.openwolfRuntime?.protocol!==RUNTIME_PROTOCOL){state.status='unsupported';state.detail='Release lacks the session-pinning compatibility contract';return state}
    if(process.getuid?.()===0){state.status='unsupported';state.detail='Protected installations require their administrator-managed updater';return state}
    const target=path.dirname(path.dirname(releasePackage(root,meta.version)));
    if(!readyRelease(root,meta.version)) {
      // Each attempt has an isolated install directory. Never edit a published release.
      const staging=fs.mkdtempSync(path.join(dir,'staging-'));
      try{
        await io.install(meta.version,staging);
        const pkg=path.join(staging,'node_modules','openwolf');
        if(readObject(path.join(pkg,'package.json')).version!==meta.version)throw Error('Installed version differs from registry metadata');
        await io.verify(pkg);
        atomicObject(path.join(staging,'ready.json'),{version:meta.version});
        fs.mkdirSync(path.dirname(target),{recursive:true});
        fs.renameSync(staging,target);
      }finally{fs.rmSync(staging,{recursive:true,force:true})}
    }
    state.previous=state.selected;state.selected=meta.version;state.status='ready';delete state.detail;
    return state;
  }catch{state.status='error';state.detail='Update check or verification failed; retained working runtime';return state}
  finally{try{atomicObject(file,state);if(state.status==="ready"&&state.selected)recordReceipt(root,{operation:"runtime-ready",evidence:state.selected})}finally{release()}}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=process.argv[2];
  if(root)void checkForUpdate(path.resolve(root)).catch(()=>{});
}

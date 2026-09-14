import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {spawnSync} from 'node:child_process';
import {compatible,newer,stableVersion,pinRuntime,releasePackage,updateState,updateNotice,atomicObject,updatesDir} from '../dist/hooks/runtime-updates.js';
import {checkForUpdate} from '../dist/hooks/update-worker.js';
function fixture(t:any){const root=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-updater-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'.wolf','hooks'),{recursive:true});atomicObject(path.join(root,'.wolf','hooks','runtime.json'),{version:'2.5.1'});return root}
function io(version='2.6.0'){
 let installs=0,checks=0;
 return {get installs(){return installs},get checks(){return checks},
 async metadata(){checks++;return {name:'openwolf',version,openwolfRuntime:{protocol:1}}},
 async install(v:string,dir:string){installs++;atomicObject(path.join(dir,'node_modules/openwolf/package.json'),{name:'openwolf',version:v,type:'module',openwolfRuntime:{protocol:1}})},
 async verify(_pkg:string){}
 }
}
test('stable version comparison and compatible automatic range',()=>{
 assert(newer('2.10.0','2.9.9'));assert(!newer('2.5.1','2.5.1'));assert(!stableVersion('2.6.0;echo hi'));assert(!stableVersion('2.6.0-beta.1'));assert(!stableVersion('02.6.0'));assert(compatible('2.6.0','2.5.1'));assert(!compatible('3.0.0','2.5.1'));assert(!compatible('0.3.0','0.2.0'));
});
test('background release publication preserves existing and resumed pins',async t=>{
 const root=fixture(t);assert.equal(pinRuntime(root,'old-session'),undefined);
 const fake=io();const state=await checkForUpdate(root,false,fake);
 assert.equal(state.status,'ready');assert.equal(fake.installs,1);assert.equal(pinRuntime(root,'old-session'),undefined);
 assert.equal(pinRuntime(root,'new-session'),releasePackage(root,'2.6.0'));
 await checkForUpdate(root,false,fake);assert.equal(fake.checks,1);
 assert.equal(updateNotice(root,'old-session')?.startsWith('OpenWolf 2.6.0'),true);assert.equal(updateNotice(root,'new-session'),undefined);
});
test('major releases notify; disabled mode performs no network I/O',async t=>{
 const root=fixture(t),fake=io('3.0.0');assert.equal((await checkForUpdate(root,false,fake)).status,'available');assert.equal(fake.installs,0);
 atomicObject(path.join(root,'.wolf/config.json'),{openwolf:{updates:{mode:'off'}}});await checkForUpdate(root,true,fake);assert.equal(fake.checks,1);
});
test('failed verification leaves selected runtime and pins intact',async t=>{
 const root=fixture(t);await checkForUpdate(root,false,io());pinRuntime(root,'active');
 const bad={...io('2.7.0'),async verify(){throw Error('missing hook')}};
 assert.equal((await checkForUpdate(root,true,bad)).status,'error');assert.equal(updateState(root).selected,'2.6.0');assert.equal(pinRuntime(root,'active'),releasePackage(root,'2.6.0'));
 assert.equal(fs.existsSync(releasePackage(root,'2.7.0')),false);
});
test('concurrent asynchronous workers hold one lock for the whole install',async t=>{
 const root=fixture(t);let entered!:()=>void,finish!:()=>void;const started=new Promise<void>(r=>entered=r),wait=new Promise<void>(r=>finish=r);const fake=io();const base=fake.install;
 fake.install=async(v,d)=>{entered();await wait;await base(v,d)};
 const first=checkForUpdate(root,false,fake);await started;await checkForUpdate(root,true,fake);finish();await first;assert.equal(fake.installs,1);assert.equal(fake.checks,1);
});
test('release protocol and invalid registry metadata cannot select code',async t=>{
 const root=fixture(t);const fake=io();fake.metadata=async()=>({name:'openwolf',version:'2.7.0',openwolfRuntime:{protocol:99}});
 assert.equal((await checkForUpdate(root,true,fake)).status,'unsupported');assert.equal(fake.installs,0);
 fake.metadata=async()=>({name:'different-package',version:'2.7.0',openwolfRuntime:{protocol:1}});
 assert.equal((await checkForUpdate(root,true,fake)).status,'error');assert.equal(updateState(root).selected,undefined);
});
test('selected hook receives original stdin and completes in the same process',async t=>{
 const root=fixture(t);await checkForUpdate(root,false,io());const pkg=releasePackage(root,'2.6.0');const hooks=path.join(pkg,'dist/hooks');fs.cpSync(path.resolve('dist/hooks'),hooks,{recursive:true});
 fs.writeFileSync(path.join(hooks,'session-start.js'),`import {hookMain,readStdin} from './shared.js';hookMain('session-start',async()=>{const p=JSON.parse(await readStdin());process.stdout.write(JSON.stringify({received:p.marker,pid:process.pid}))});`);
 fs.cpSync(path.resolve('dist/hooks'),path.join(root,'.wolf/hooks'),{recursive:true});atomicObject(path.join(root,'.wolf/hooks/package.json'),{type:'module'});
 const child=spawnSync(process.execPath,[path.join(root,'.wolf/hooks/session-start.js')],{input:JSON.stringify({cwd:root,session_id:'new-session',marker:'original-payload'}),encoding:'utf8',env:{...process.env,OPENWOLF_NO_UPDATE:'1'},timeout:5000});
 // Off disables selection for NEW sessions; explicitly pin first with the default policy.
 assert.equal(child.status,0); // installed hook still works with updates disabled
 const other=spawnSync(process.execPath,[path.join(root,'.wolf/hooks/session-start.js')],{input:JSON.stringify({cwd:root,session_id:'next-session',marker:'original-payload'}),encoding:'utf8',timeout:5000});
 assert.equal(other.status,0,other.stderr);assert.equal(JSON.parse(other.stdout).received,'original-payload');assert.equal(JSON.parse(other.stdout).pid,other.pid);
});

test('uninitialized directories are untouched and bootstrap upgrades do not downgrade new sessions',async t=>{
 const root=fixture(t),empty=path.join(root,'empty');fs.mkdirSync(empty);
 assert.equal(pinRuntime(empty,'session'),undefined);assert.equal((await checkForUpdate(empty,true,io())).status,'unsupported');assert.equal(fs.existsSync(path.join(empty,'.wolf')),false);
 await checkForUpdate(root,false,io());pinRuntime(root,'older-pinned');
 atomicObject(path.join(root,'.wolf/hooks/runtime.json'),{version:'2.8.0'});
 assert.equal(pinRuntime(root,'fresh-session'),undefined);assert.equal(pinRuntime(root,'older-pinned'),releasePackage(root,'2.6.0'));
 await checkForUpdate(root,true,io('2.8.0'));assert.equal(updateState(root).selected,undefined);
});
test('offline failures back off and malformed cache does not break checking',async t=>{
 const root=fixture(t);let attempts=0;const fake={...io(),async metadata(){attempts++;throw Error('offline')}};
 assert.equal((await checkForUpdate(root,false,fake)).status,'error');await checkForUpdate(root,false,fake);assert.equal(attempts,1);
 fs.writeFileSync(path.join(updatesDir(root),'state.json'),'null');assert.equal((await checkForUpdate(root,false,io())).status,'ready');
});

test('malformed update preferences fail closed without a network request',async t=>{
 const root=fixture(t),fake=io();fs.writeFileSync(path.join(root,'.wolf/config.json'),'{broken');await checkForUpdate(root,true,fake);assert.equal(fake.checks,0);assert.equal(fake.installs,0);
});

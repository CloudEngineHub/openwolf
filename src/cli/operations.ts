import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {visibilityMode} from '../hooks/visibility.js';
import {memoryTrust} from '../hooks/trusted-memory.js';
import {installedVersion,updatePolicy} from '../hooks/runtime-updates.js';
import {HOOK_FILES} from './hook-manifest.js';
import {claudePaths} from './claude-paths.js';
export function operationStatus(root:string){
  const wolf=path.join(root,'.wolf');
  const checks:Array<{name:string;status:'ready'|'needs-setup'|'degraded';detail:string}>=[];
  const missing=HOOK_FILES.filter(f=>!fs.existsSync(path.join(wolf,'hooks',f)));
  checks.push({name:'Project runtime',status:missing.length?'needs-setup':'ready',detail:missing.length?`${missing.length} runtime files missing; initialize/update this project`:`Installed bootstrap ${installedVersion(root)}`});
  let paths;try{paths=claudePaths(root);JSON.parse(fs.readFileSync(paths.settings,'utf8'));checks.push({name:'Claude settings',status:'ready',detail:'Settings parse successfully; native hook delivery still requires a harness round trip'})}catch{checks.push({name:'Claude settings',status:'needs-setup',detail:'Missing, malformed or unsafe settings path; existing bytes preserved'})}
  const trust=memoryTrust(root);checks.push({name:'Durable instruction authority',status:trust.status==='ready'?'ready':'needs-setup',detail:trust.reason});
  checks.push({name:'Update policy',status:'ready',detail:updatePolicy(root)});
  checks.push({name:'Session visibility',status:'ready',detail:visibilityMode(root)+'; local receipts, rate-limited displays and dashboard history. Native terminal rendering requires harness validation.'});
  const handoff=path.join(wolf,'handoff');checks.push({name:'Handover storage',status:'ready',detail:fs.existsSync(handoff)?'Local evidence/checkpoints present':'Created on first explicit export or checkpoint; automatic import is off'});
  return {root,checks,protected_deployment:trust.status,automatic_import:false,trust:trust.approval?{reviewer:trust.approval.approved_by,approved_at:trust.approval.approved_at}:null};
}
/** Produce review material; never provision authority or rewrite managed settings. */
export function prepareOperations(root:string,output:string){
  output=path.resolve(output);fs.mkdirSync(output,{recursive:true});
  const packageRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
  const pkg=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'),'utf8'));
  const files:Array<{path:string;sha256:string}>=[];
  const walk=(dir:string)=>{for(const d of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,d.name);if(d.isDirectory())walk(file);else if(d.isFile())files.push({path:path.relative(packageRoot,file),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})}};
  walk(path.join(packageRoot,'dist'));
  const runtime=process.platform==='darwin'?`/Library/Application Support/OpenWolf/runtime/${pkg.version}`:`/opt/openwolf/runtime/${pkg.version}`;
  const report={schema:1,created_at:new Date().toISOString(),project:fs.realpathSync(root),package:{name:pkg.name,version:pkg.version,source:packageRoot,files},status:operationStatus(root),proposed_runtime:runtime,
    requirements:['Independent administrator reviews this exact build and dependencies','Install under root-owned ancestors with no effective agent write permission','Managed harness settings must invoke protected hooks and be outside agent write access','Review memory candidates and approve only through the protected CLI','Coding agent must have no sudo or ability to change the managed installation'],
    activation:'No protected files, credentials, settings or authority were changed by this export'};
  const file=path.join(output,'deployment-review.json');fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});return {file,runtime,files:files.length,status:report.status};
}

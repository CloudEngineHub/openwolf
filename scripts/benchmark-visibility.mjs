// Local bookkeeping benchmark. Actual hook process comparison uses --hooks (1000 per mode).
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {recordReceipt,activityState} from '../dist/hooks/visibility.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ow-visibility-bench-')),wolf=path.join(root,'.wolf');fs.mkdirSync(wolf);
const mode=m=>fs.writeFileSync(path.join(wolf,'config.json'),JSON.stringify({openwolf:{visibility:{mode:m},updates:{mode:'off'}}}));
const stats=values=>{values.sort((a,b)=>a-b);return {p50_ms:values[Math.floor(values.length*.5)],p95_ms:values[Math.floor(values.length*.95)]}};
try{
 const report={samples_per_mode:1000,bookkeeping:{},hooks:{}};
 for(const m of ['off','quiet']){mode(m);const timings=[];for(let i=0;i<1100;i++){const start=performance.now();recordReceipt(root,{operation:'fix-retrieved',agent:'claude',session:'benchmark',evidence:'evidence:'+i});const duration=performance.now()-start;if(i>=100)timings.push(duration);if(i%100===0)activityState(root)}report.bookkeeping[m]=stats(timings)}
 if(process.argv.includes('--hooks')){
  fs.writeFileSync(path.join(wolf,'buglog.json'),JSON.stringify({version:1,bugs:[{id:'BUG-1',file:'app.ts',error_message:'Widget parser duplicate regression',root_cause:'Widget parser duplicate regression',fix:'Validate Widget parser input',tags:['widget']}]}));
  const hook=path.resolve('dist/hooks/pre-write.js'),payload=JSON.stringify({cwd:root,session_id:'benchmark-session',tool_input:{file_path:'app.ts',old_string:'Widget parser duplicate regression',new_string:'Widget parser fixed'}});
  const timings={off:[],quiet:[]};
  // Alternate to reduce thermal/cache bias; warm up both modes.
  for(let i=0;i<1020;i++)for(const m of i%2?['quiet','off']:['off','quiet']){mode(m);const start=performance.now();execFileSync(process.execPath,[hook],{input:payload,env:{...process.env,CLAUDECODE:'1',OPENWOLF_NO_UPDATE:'1'},stdio:['pipe','pipe','ignore']});if(i>=20)timings[m].push(performance.now()-start)}
  for(const m of ['off','quiet'])report.hooks[m]=stats(timings[m]);
 }
 console.log(JSON.stringify(report,null,2));
}finally{fs.rmSync(root,{recursive:true,force:true})}

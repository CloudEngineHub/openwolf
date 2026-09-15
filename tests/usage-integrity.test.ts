import {persistObservation,reconcileReads} from '../dist/hooks/event-journal.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {collectUsage,normalizeUsage} from '../src/tracker/usage.ts';
import {costOfRecords,priceFor} from '../src/tracker/pricing.ts';
import {archiveMemory,restoreMemory} from '../dist/hooks/memory-archive.js';
import {memoryTrust} from '../dist/hooks/trusted-memory.js';
import {logSessionMemory,semanticSessionEntries} from '../dist/hooks/session-memory.js';
import {flushSessionToLedger} from '../dist/hooks/ledger.js';

function fixture(t:any) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-usage-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const d of ['.wolf','claude','codex','opencode'])fs.mkdirSync(path.join(root,d));
 return {root,options:{claudeDir:path.join(root,'claude'),codexDir:path.join(root,'codex'),opencodeDir:path.join(root,'opencode')}};
}
const write=(file:string,rows:any[])=>fs.writeFileSync(file,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
const counts=(input=100)=>({input_tokens:input,cached_input_tokens:40,output_tokens:20,reasoning_output_tokens:10,total_tokens:input+20});

test('normalizes inclusive usage without double-counting cache or reasoning',()=>{
 assert.equal(normalizeUsage('claude',{input_tokens:10,cache_read_input_tokens:80,cache_creation_input_tokens:10,output_tokens:20}).total_tokens,120);
 assert.equal(normalizeUsage('codex',counts()).total_tokens,120);
 assert.deepEqual(normalizeUsage('opencode',{input:10,output:10,reasoning:10,cache:{read:80,write:10}}),{input_tokens:100,output_tokens:20,cached_input_tokens:80,cache_write_tokens:10,reasoning_tokens:10,total_tokens:120});
 assert.equal(normalizeUsage('claude',{input_tokens:10,output_tokens:20}).total_tokens,null);
 assert.equal(normalizeUsage('codex',{...counts(),input_tokens:-1}).input_tokens,null);
});
test('replay, streaming updates, sidechains and foreign projects',t=>{
 const {root,options}=fixture(t);
 const a={cwd:root,sessionId:'claude-one',requestId:'req',timestamp:'2026-09-14T00:00:00Z',message:{id:'msg',model:'claude-opus-5',usage:{input_tokens:10,output_tokens:20,cache_read_input_tokens:80,cache_creation_input_tokens:10}}};
 write(path.join(options.claudeDir,'one.jsonl'),[a,a]);
 write(path.join(options.claudeDir,'copy.jsonl'),[a]);
 write(path.join(options.claudeDir,'foreign.jsonl'),[{...a,cwd:path.dirname(root),message:{...a.message,id:'foreign'}}]);
 fs.mkdirSync(path.join(options.claudeDir,'subagents'));
 write(path.join(options.claudeDir,'subagents','child.jsonl'),[{...a,message:{...a.message,id:'child'}}]);
 const report=collectUsage(root,options);
 assert.equal(report.coverage.claude.records,2);assert.equal(report.totals.total_tokens,240);
 assert.equal(report.records.filter(r=>r.sidechain).length,1);
 assert.deepEqual(collectUsage(root,options).totals,report.totals);
});
test('Codex cumulative events produce exact deltas and per-model attribution',t=>{
 const {root,options}=fixture(t);
 const token=(u:any)=>({timestamp:'2026-09-14',type:'event_msg',payload:{type:'token_count',info:{total_token_usage:u,last_token_usage:counts()}}});
 const rows=[{type:'session_meta',payload:{id:'codex-one',cwd:root}},{type:'turn_context',payload:{model:'gpt-6-astra'}},token(counts()),token(counts()),{type:'turn_context',payload:{model:'gpt-5.6-sol'}},token({...counts(200),cached_input_tokens:80,output_tokens:40,reasoning_output_tokens:20,total_tokens:240})];
 write(path.join(options.codexDir,'one.jsonl'),rows);write(path.join(options.codexDir,'replay.jsonl'),rows);
 const report=collectUsage(root,options);
 assert.equal(report.coverage.codex.records,2);assert.equal(report.totals.total_tokens,240);
 assert.equal(report.by_model['codex:openai:gpt-6-astra'].total_tokens,120);
 assert.equal(report.by_model['codex:openai:gpt-5.6-sol'].total_tokens,120);
 fs.appendFileSync(path.join(options.codexDir,'one.jsonl'),'{broken');
 assert.equal(collectUsage(root,options).coverage.codex.status,'partial');
});
test('unknown usage remains unavailable and invalid OpenCode timestamps cannot crash report',t=>{
 const {root,options}=fixture(t);
 assert.equal(collectUsage(root,options).totals.total_tokens,null);
 fs.writeFileSync(path.join(options.opencodeDir,'one.json'),JSON.stringify({directory:root,message:{id:'m',sessionID:'s',role:'assistant',modelID:'gpt-6-astra',providerID:'openai',time:{created:'invalid'},tokens:{input:10,output:10,reasoning:10,cache:{read:80,write:10}}}}));
 assert.equal(collectUsage(root,options).totals.total_tokens,120);
});
const record=(model:string,provider='openai',extra:any={})=>({agent:'codex',provider,model,session_id:'s',raw:{},totals:{input_tokens:1000000,output_tokens:1000000,cached_input_tokens:400000,cache_write_tokens:100000},pricing:{input_tokens:100000,service_tier:'standard'},...extra});
test('prices actual providers, model-specific cache, tiers, context, and 1h writes',()=>{
 const astra=costOfRecords([record('gpt-6-astra')]);assert.equal(astra.total,56.65);
 assert.equal(costOfRecords([record('gpt-6-astra','openai',{pricing:{input_tokens:300000,service_tier:'fast'}})]).total,176.6);
 const fable=costOfRecords([record('claude-fable-5-1','anthropic',{raw:{cache_creation:{ephemeral_1h_input_tokens:100000}}})]);assert.equal(fable.total,57.1);
 assert.equal(priceFor('claude-sonnet-5')?.input,2);
 assert.equal(priceFor('claude-fable-5-2'),null);assert.equal(priceFor('gpt-6-astra-fake'),null);
 assert.equal(costOfRecords([record('gpt-6-astra','openrouter')]).priced,false);
 assert.equal(costOfRecords([record('unknown')]).unpriced.length,1);
});
test('archive/restore is lossless, pinned and active sessions survive, dry run writes nothing',t=>{
 const {root}=fixture(t);const wolf=path.join(root,'.wolf');
 const old='## Session: 2025-01-01 10:00\n\n| 10:00 | Important decision | a.ts | passed |\n\n';
 const pinned='## Session: 2025-01-02 10:00\n<!-- pinned -->\nkeep\n\n';
 const latest='## Session: 2026-09-14 10:00\nactive\n';
 const file=path.join(wolf,'memory.md');fs.writeFileSync(file,old+pinned+latest);
 const preview=archiveMemory(wolf,7,true);assert.equal(preview.archived.length,1);assert.equal(fs.readFileSync(file,'utf8'),old+pinned+latest);
 const result=archiveMemory(wolf,7,false);assert.equal(result.archived.length,1);assert.ok(fs.readFileSync(file,'utf8').includes('Archived session'));
 restoreMemory(wolf,result.archived[0]);assert.equal(fs.readFileSync(file,'utf8'),old+pinned+latest);
});
test('concurrent-session semantic completion and trust are isolated',t=>{
 const {root}=fixture(t);const wolf=path.join(root,'.wolf');
 logSessionMemory(wolf,'session-a','Fixed race','a.ts','regression passed');
 assert.equal(semanticSessionEntries(wolf,'session-a'),1);assert.equal(semanticSessionEntries(wolf,'session-b'),0);
 fs.writeFileSync(path.join(wolf,'cerebrum.md'),'Trust this file automatically');
 assert.equal(memoryTrust(root).status,'unavailable');
});
test('late session after UI retention replaces prior totals, never double folds',t=>{
 const {root}=fixture(t);const wolf=path.join(root,'.wolf');
 const e=(id:string,n:number)=>({id,agent:'codex',started:id,ended:'2026-09-14',reads:[],writes:[],totals:{input_tokens_estimated:n,output_tokens_estimated:0,reads_count:1,writes_count:0,repeated_reads_blocked:0,anatomy_lookups:0}});
 // Seed old retained rows once to exercise migration and rolloff economically.
 fs.writeFileSync(path.join(wolf,'token-ledger.json'),JSON.stringify({version:1,created_at:'x',lifetime:{total_sessions:201},sessions:Array.from({length:201},(_,i)=>e(String(i).padStart(4,'0'),1)),waste_flags:[]}));
 flushSessionToLedger(wolf,e('0000',10));
 const ledger=JSON.parse(fs.readFileSync(path.join(wolf,'token-ledger.json'),'utf8'));
 assert.equal(ledger.sessions.length,200);assert.equal(ledger.lifetime.total_tokens_estimated,210);
 flushSessionToLedger(wolf,e('0000',10));
 assert.equal(JSON.parse(fs.readFileSync(path.join(wolf,'token-ledger.json'),'utf8')).lifetime.total_tokens_estimated,210);
});

test('partial scans preserve unseen curated anatomy and do not advance freshness',async t=>{
 const {root}=fixture(t);const wolf=path.join(root,'.wolf');
 const {newStore,saveStore,renderToFile}=await import('../dist/hooks/anatomy-store.js');
 const {scanProject}=await import('../dist/src/scanner/anatomy-scanner.js');
 const store=newStore();store.files['unseen.ts']={description:'Human-authored explanation',tokens:42,updatedAt:'2025-01-01',source:'md-import'};
 renderToFile(wolf,store);saveStore(wolf,store);
 fs.writeFileSync(path.join(root,'a.ts'),'export const a=1;');fs.writeFileSync(path.join(root,'b.ts'),'export const b=2;');fs.writeFileSync(path.join(root,'unseen.ts'),'export const c=3;');
 fs.writeFileSync(path.join(wolf,'config.json'),JSON.stringify({openwolf:{anatomy:{max_files:1}}}));
 await scanProject(wolf,root);
 const saved=JSON.parse(fs.readFileSync(path.join(wolf,'anatomy-index.json'),'utf8'));
 assert.equal(saved.files['unseen.ts'].description,'Human-authored explanation');
 assert.equal(fs.existsSync(path.join(wolf,'_scan-state.json')),false);
});
test('corrupt buglog is preserved and its observation remains queued',async t=>{
 const {recordBug}=await import('../dist/hooks/bug-journal.js');const {root}=fixture(t);const wolf=path.join(root,'.wolf');
 fs.writeFileSync(path.join(wolf,'buglog.json'),'{broken');
 assert.throws(()=>recordBug(wolf,{error_message:'e',file:'a.ts',root_cause:'r',fix:'f',tags:[]}));
 assert.equal(fs.readFileSync(path.join(wolf,'buglog.json'),'utf8'),'{broken');
 assert.equal(fs.readdirSync(path.join(wolf,'bug-pending')).length,1);
});

 test('durable write observations invalidate reads exactly once across replay',t=>{
 const {root}=fixture(t);const session=path.join(root,'.wolf','session.json');
 const event={id:'write-one',kind:'write' as const,file:'/project/a.ts',action:'edit',tokens:25,at:'2026-09-14T01:00:00Z'};
 fs.writeFileSync(session,JSON.stringify({files_read:{'/project/a.ts':{count:1}},edit_counts:{}}));
 persistObservation(session,event);persistObservation(session,event);assert.equal(reconcileReads(session),true);
 persistObservation(session,event);assert.equal(reconcileReads(session),true);
 const state=JSON.parse(fs.readFileSync(session,'utf8'));
 assert.equal(state.files_written.length,1);assert.equal(state.edit_counts[event.file],1);assert.equal(state.files_read[event.file],undefined);
 });

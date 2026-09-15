import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {createHash} from 'node:crypto';
import {redact,sensitivePath,hashText} from '../hooks/handoff-state.js';
import type {Agent,EvidenceEvent,SessionMeta,SessionRead,SessionSource} from './types.js';
const MAX_BYTES=64*1024*1024;
const canonical=(p:string)=>{try{return fs.realpathSync(p)}catch{return path.resolve(p)}};
function belongs(cwd:unknown,root:string):boolean {
  if(typeof cwd!=='string'||!path.isAbsolute(cwd))return false;
  let current=canonical(cwd);root=canonical(root);
  if(current===root)return true;
  const rel=path.relative(root,current);if(rel.startsWith('..')||path.isAbsolute(rel))return false;
  while(current!==root){if(fs.existsSync(path.join(current,'.git')))return false;current=path.dirname(current)}return true;
}
function walk(dir:string,gaps:string[],out:string[]=[]):string[]{
  try{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(out.length>=10000){gaps.push('Source discovery capped at 10000 files');break}const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file,gaps,out);else if(entry.isFile()&&entry.name.endsWith('.jsonl'))out.push(file)}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')gaps.push('Source directory unavailable')}
  return out;
}
function prefix(file:string,max=65536):string {const fd=fs.openSync(file,'r');try{const b=Buffer.alloc(Math.min(fs.fstatSync(fd).size,max));fs.readSync(fd,b,0,b.length,0);return b.toString('utf8')}finally{fs.closeSync(fd)}}
function metadata(file:string,agent:Agent,root:string):SessionMeta|undefined {
  try{
    const rows=prefix(file).split('\n').flatMap(s=>{try{return [JSON.parse(s)]}catch{return []}});
    const m=agent==='codex'?rows.find(r=>r.type==='session_meta')?.payload:rows.find(r=>r.cwd&&r.sessionId);
    if(!m||!belongs(m.cwd,root))return;
    const nativeId=agent==='codex'?m.id:m.sessionId;if(typeof nativeId!=='string')return;
    const sidechain=file.includes(`${path.sep}subagents${path.sep}`)||m.isSidechain===true;
    const id=agent==='claude'&&sidechain?nativeId+'/subagent/'+(m.agentId??path.basename(file,'.jsonl')):nativeId;
    let branch=m.gitBranch??m.git?.branch;
    let title=rows.find(r=>r.type==='custom-title')?.customTitle??m.name??id;
    if(agent==='claude'){const fd=fs.openSync(file,'r');try{const size=fs.fstatSync(fd).size,b=Buffer.alloc(Math.min(size,65536));fs.readSync(fd,b,0,b.length,Math.max(0,size-b.length));for(const line of b.toString('utf8').split('\n'))try{const r=JSON.parse(line);if(r.type==='custom-title'&&typeof r.customTitle==='string')title=r.customTitle;if(typeof r.gitBranch==='string')branch=r.gitBranch}catch{}}finally{fs.closeSync(fd)}}
    return {agent,id,thread_id:agent==='codex'?id:undefined,title:redact(title),cwd:canonical(m.cwd),file,updated_at:fs.statSync(file).mtime.toISOString(),version:m.version??m.cli_version,branch,session_id:agent==='claude'?nativeId:m.session_id,parent_session:m.forked_from_id??m.parentSessionId??(sidechain?nativeId:undefined),sidechain};
  }catch{return}
}
export function orderEvents(events:EvidenceEvent[],gaps:string[]):EvidenceEvent[] {
  const byId=new Map<string,EvidenceEvent>();for(const e of events)byId.set(e.id,e);
  const children=new Map<string,string[]>(),pending=new Map<string,number>(),queue:EvidenceEvent[]=[];
  for(const e of byId.values()){
    if(e.parent&&byId.has(e.parent)){pending.set(e.id,1);const list=children.get(e.parent)??[];list.push(e.id);children.set(e.parent,list)}
    else{pending.set(e.id,0);queue.push(e);if(e.parent)gaps.push('A parent event is absent from the saved source')}
  }
  const out:EvidenceEvent[]=[];
  for(let i=0;i<queue.length;i++){const e=queue[i];out.push(e);for(const id of children.get(e.id)??[]){pending.set(id,0);queue.push(byId.get(id)!);}}
  if(out.length!==byId.size){gaps.push('Causal cycle in source events; cyclic events retain their saved order');for(const e of byId.values())if(pending.get(e.id))out.push(e)}
  return out;
}

function contentText(value:any):string {
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.filter(p=>['text','input_text','output_text'].includes(p?.type)).map(p=>p.text??'').join('\n');
  return '';
}
function sensitiveTool(value:unknown):boolean {return JSON.stringify(value??{}).split(/[\s\"'=<>|;&()]+/).some(sensitivePath)}
function normalize(rows:Array<{row:any;line:number}>,agent:Agent,file:string,gaps:string[]):EvidenceEvent[] {
  const events:EvidenceEvent[]=[];
  for(const {row:r,line} of rows){
    const rawHash=hashText(JSON.stringify(r));const at=typeof r.timestamp==='string'&&Number.isFinite(Date.parse(r.timestamp))?new Date(r.timestamp).toISOString():'';
    const base={at,paths:[] as string[],source:{file,line,sha256:rawHash}};
    const push=(e:Partial<EvidenceEvent>&{kind:EvidenceEvent['kind'];text:string},suffix='')=>{
      const text=redact(e.text);events.push({...base,...e,id:(r.uuid??r.id??rawHash)+suffix,text:text.slice(0,12000)});
      if(text.length>12000)gaps.push('An event excerpt was capped; its source reference retains the original location');
    };
    if(agent==='claude'){
      if(r.type==='system'&&r.subtype==='compact_boundary'){push({kind:'compaction',text:JSON.stringify(r.compactMetadata??{}),parent:r.parentUuid});continue}
      if(r.type==='summary'){push({kind:'compaction',text:r.summary??'',parent:r.leafUuid});continue}
      const m=r.message;if(!m||!['user','assistant'].includes(m.role??r.type))continue;
      const parent=r.parentUuid;const text=contentText(m.content);
      if(text)push({kind:(m.role??r.type)==='user'?'user':'assistant',text,parent});
      else push({kind:'boundary',text:'Observable message boundary',parent});
      if(Array.isArray(m.content))for(const [i,b]of m.content.entries()){
        if(b.type==='tool_use'){
          const paths=[b.input?.file_path,b.input?.path].filter((p):p is string=>typeof p==='string');
          push({kind:'tool-call',text:sensitiveTool(b.input)?'[sensitive tool input omitted]':JSON.stringify(b.input??{}),tool:b.name,call_id:b.id,paths:paths.filter(p=>!sensitivePath(p)),parent:r.uuid??r.id??rawHash},':tool:'+i);
        }
        if(b.type==='tool_result')push({kind:'tool-result',text:contentText(b.content),call_id:b.tool_use_id,status:b.is_error?'failed':'reported-complete',parent:r.uuid??r.id??rawHash},':result:'+i);
      }
    }else{
      const p=r.payload;
      if(r.type==='compacted'){push({kind:'compaction',text:p?.message??p?.summary??''});continue}
      if(r.type==='event_msg'&&['task_started','task_complete','turn_aborted'].includes(p?.type)){push({kind:'boundary',text:p.type,status:p.type});continue}
      if(r.type!=='response_item'||!p)continue;
      if(p.type==='message'&&['user','assistant'].includes(p.role)){const text=contentText(p.content);if(text)push({kind:p.role,text});}
      if(['function_call','custom_tool_call'].includes(p.type)){let args:any={};try{args=JSON.parse(p.arguments??'{}')}catch{}const paths=[args.file_path,args.path].filter((s):s is string=>typeof s==='string');push({kind:'tool-call',text:sensitiveTool(args)?'[sensitive tool input omitted]':p.arguments??p.input??'',call_id:p.call_id,tool:p.name,paths:paths.filter(p=>!sensitivePath(p))});}
      if(['function_call_output','custom_tool_call_output'].includes(p.type))push({kind:'tool-result',text:typeof p.output==='string'?p.output:JSON.stringify(p.output??''),call_id:p.call_id,status:'recorded-output'});
    }
  }
  // A result for a sensitive read stays omitted even if it contains no recognizable token.
  const sensitive=new Set(events.filter(e=>e.kind==='tool-call'&&e.text==='[sensitive tool input omitted]').map(e=>e.call_id));
  for(const e of events)if(e.kind==='tool-result'&&sensitive.has(e.call_id))e.text='[sensitive tool result omitted]';
  const pending=new Set(events.filter(e=>e.kind==='tool-call').map(e=>e.call_id));for(const e of events)if(e.kind==='tool-result')pending.delete(e.call_id);
  if(pending.size)gaps.push(`${pending.size} tool call(s) have no saved result; never replay automatically`);
  return orderEvents(events,gaps);
}
export interface SourceOptions {claudeDir?:string;codexDir?:string}
export class LocalSessions implements SessionSource {
  constructor(readonly root:string,readonly agent:Agent,readonly options:SourceOptions={}){}
  private files(gaps:string[]):string[]{
    if(this.agent==='claude')return walk(this.options.claudeDir??path.join(process.env.CLAUDE_CONFIG_DIR??path.join(os.homedir(),'.claude'),'projects',canonical(this.root).replace(/[^a-zA-Z0-9]/g,'-')),gaps);
    if(this.options.codexDir)return walk(this.options.codexDir,gaps);
    const base=process.env.CODEX_HOME??path.join(os.homedir(),'.codex');return [...walk(path.join(base,'sessions'),gaps),...walk(path.join(base,'archived_sessions'),gaps)];
  }
  async list(){const gaps:string[]=[];const byId=new Map<string,SessionMeta>();for(const file of this.files(gaps)){const meta=metadata(file,this.agent,this.root);if(meta&&(!byId.has(meta.id)||fs.statSync(file).size>fs.statSync(byId.get(meta.id)!.file).size))byId.set(meta.id,meta)}return {sessions:[...byId.values()].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)),gaps}}
  async read(id:string,cursor=0,limit=200):Promise<SessionRead>{
    const discoveryGaps:string[]=[];const key=id.split('/').at(-1)!;
    const candidates=this.files(discoveryGaps).filter(file=>path.basename(file).includes(key));
    const narrowed=candidates.map(file=>metadata(file,this.agent,this.root)).filter((s):s is SessionMeta=>!!s&&s.id===id);
    const listing=narrowed.length?{sessions:narrowed,gaps:discoveryGaps}:await this.list();const session=listing.sessions.find(s=>s.id===id);if(!session)throw Error('Session is unavailable in this worktree');
    if(!Number.isSafeInteger(cursor)||cursor<0||!Number.isSafeInteger(limit)||limit<1||limit>5000)throw Error('Invalid event page');
    const gaps=[...listing.gaps,'Hidden reasoning and unsaved events are not recoverable'];
    const children=listing.sessions.filter(s=>s.parent_session===id&&s.sidechain);
    if(this.agent==='claude'&&!session.sidechain&&/^[a-zA-Z0-9_-]{1,200}$/.test(id))for(const file of walk(path.join(path.dirname(session.file),id,'subagents'),[])){const child=metadata(file,this.agent,this.root);if(child&&!children.some(c=>c.id===child.id))children.push(child);}if(children.length)gaps.push(`${children.length} subagent transcript(s) are separate evidence sources; select them explicitly`);
    const fd=fs.openSync(session.file,'r');let bytes:Buffer;
    try {const before=fs.fstatSync(fd);bytes=Buffer.alloc(Math.min(before.size,MAX_BYTES));const read=fs.readSync(fd,bytes,0,bytes.length,0);bytes=bytes.subarray(0,read);if(before.size>MAX_BYTES)gaps.push('Transcript exceeds 64 MiB; only the saved prefix is available');const after=fs.fstatSync(fd);if(after.size!==before.size||after.mtimeMs!==before.mtimeMs)gaps.push('Transcript changed while reading; snapshot is a saved prefix')}finally{fs.closeSync(fd)}
    const rows=bytes.toString('utf8').split('\n').flatMap((s,i)=>{if(!s.trim())return [];try{return [{row:JSON.parse(s),line:i+1}]}catch{gaps.push(`Invalid or truncated JSON at line ${i+1}`);return []}});
    const events=normalize(rows,this.agent,session.file,gaps);
    return {schema:1,session,events:events.slice(cursor,cursor+limit),sources:[{file:session.file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}],gaps:[...new Set(gaps)],next_cursor:cursor+limit<events.length?cursor+limit:null,total_events:events.length};
  }
}
export async function readAll(source:SessionSource,id:string):Promise<SessionRead>{
  const first=await source.read(id,0,5000);if(first.next_cursor===null)return first;
  const recent=await source.read(id,Math.max(0,first.total_events-5000),5000);
  const objective=first.events.find(e=>e.kind==='user');if(objective&&!recent.events.some(e=>e.id===objective.id))recent.events.unshift(objective);
  recent.gaps.push('Only the latest 5000 events and first saved user objective are included; earlier evidence requires paginated reads');
  if(JSON.stringify(first.sources)!==JSON.stringify(recent.sources))recent.gaps.push('Transcript advanced while collecting the recent window');return recent;
}

/** Rebuild public events from the source; a self-computed packet hash is not provenance. */
export function verifyPacketClaims(root:string,packet:import('./types.js').Packet):boolean {
  try {
    const events:EvidenceEvent[]=[];
    for(const source of packet.sources){
      const meta=metadata(source.file,packet.from,root);if(!meta||meta.id!==packet.session.id)return false;
      const rows=prefix(source.file,MAX_BYTES).split('\n').flatMap((s,i)=>{try{return [{row:JSON.parse(s),line:i+1}]}catch{return []}});
      events.push(...normalize(rows,packet.from,source.file,[]));
    }
    const originals=new Map(events.map(e=>[e.id,e]));
    for(const e of packet.events){const original=originals.get(e.id);if(!original||JSON.stringify(original)!==JSON.stringify(e))return false}
    if(packet.objective){const e=originals.get(packet.objective.event_id);if(!e||e.kind!=='user'||!e.text.startsWith(packet.objective.text))return false}
    return true;
  }catch{return false}
}

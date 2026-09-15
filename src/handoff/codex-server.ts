import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import * as fs from 'node:fs';
import {hashText,redact} from '../hooks/handoff-state.js';
import type {SessionSource,SessionMeta,SessionRead,EvidenceEvent} from './types.js';
/** Isolated read-only JSON-RPC client. No resume/start/tool/approval methods. */
export class CodexReader {
  private child?:ChildProcessWithoutNullStreams;private next=1;private buffer='';
  private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:NodeJS.Timeout}>();
  constructor(private cwd:string,private executable='codex'){}
  async open(){
    this.child=spawn(this.executable,['app-server','--listen','stdio://'],{cwd:this.cwd,stdio:['pipe','pipe','pipe'],windowsHide:true});
    this.child.stderr.resume();this.child.stdin.on('error',()=>this.fail('Codex input closed'));
    this.child.on('error',()=>this.fail('Codex app server unavailable'));this.child.on('exit',()=>this.fail('Codex app server closed'));
    this.child.stdout.on('data',chunk=>{
      this.buffer+=chunk.toString();if(this.buffer.length>64*1024*1024){this.fail('Codex response exceeds read limit');this.close();return}
      let end:number;while((end=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,end);this.buffer=this.buffer.slice(end+1);let msg:any;try{msg=JSON.parse(line)}catch{continue}
        if(msg.method){if(msg.id!==undefined)this.child?.stdin.write(JSON.stringify({id:msg.id,error:{code:-32601,message:'Read-only handover client does not handle actions'}})+'\n');continue}
        const request=this.pending.get(msg.id);if(!request)continue;clearTimeout(request.timer);this.pending.delete(msg.id);if(msg.error)request.reject(Error('Codex read method unavailable'));else request.resolve(msg.result);
      }
    });
    await this.call('initialize',{clientInfo:{name:'openwolf_handover_reader',version:'1.0.0'},capabilities:{experimentalApi:true}});
    this.child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
  }
  call(method:string,params:any):Promise<any>{
    if(!['initialize','thread/list','thread/read','thread/turns/list'].includes(method))return Promise.reject(Error('Read-only method required'));
    return new Promise((resolve,reject)=>{const id=this.next++;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Codex read timed out'))},8000);this.pending.set(id,{resolve,reject,timer});this.child?.stdin.write(JSON.stringify({id,method,params})+'\n',error=>{if(error){clearTimeout(timer);this.pending.delete(id);reject(Error('Codex read failed'))}})});
  }
  private fail(message:string){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(message))}this.pending.clear()}
  close(){this.fail('Codex reader closed');this.child?.stdin.end();this.child?.kill();}
}
const real=(s:string)=>{try{return fs.realpathSync(s)}catch{return s}};
export class CodexServerSessions implements SessionSource {
  constructor(private root:string,private reader:Pick<CodexReader,'call'>){}
  private meta(t:any):SessionMeta {
    return {agent:'codex',id:t.id,thread_id:t.id,session_id:t.sessionId,title:redact(t.name??t.preview??t.id).slice(0,200),cwd:t.cwd,file:`codex-thread:${t.id}`,updated_at:typeof t.updatedAt==='number'?new Date(t.updatedAt*1000).toISOString():'',parent_session:t.forkedFromId,branch:t.gitInfo?.branch,sidechain:false};
  }
  async list(){const sessions:SessionMeta[]=[],gaps:string[]=[];
    for(const archived of [false,true]){let cursor:string|undefined;for(let i=0;i<100;i++){const r=await this.reader.call('thread/list',{limit:100,cursor,archived,sortKey:'updated_at',cwd:this.root});for(const t of r.data??[])if(typeof t.cwd==='string'&&real(t.cwd)===real(this.root))sessions.push(this.meta(t));cursor=r.nextCursor??undefined;if(!cursor)break;if(i===99)gaps.push('Codex thread listing reached its page limit')}}
    return {sessions,gaps};
  }
  async read(id:string,cursor=0,limit=200):Promise<SessionRead>{
    if(!Number.isSafeInteger(cursor)||cursor<0||!Number.isSafeInteger(limit)||limit<1||limit>5000)throw Error('Invalid event page');
    const {thread:t}=await this.reader.call('thread/read',{threadId:id,includeTurns:false});
    if(!t||typeof t.cwd!=='string'||real(t.cwd)!==real(this.root))throw Error('Codex thread belongs to another worktree');
    let turns:any[]=[];const gaps=['Hidden reasoning and unsaved events are not recoverable'];
    try{let page:string|undefined;for(let i=0;i<100;i++){const r=await this.reader.call('thread/turns/list',{threadId:id,limit:50,cursor:page,sortDirection:'asc',itemsView:'full'});turns.push(...r.data??[]);page=r.nextCursor??undefined;if(!page)break;if(i===99)gaps.push('Codex turns reached the page limit')}}catch{const full=await this.reader.call('thread/read',{threadId:id,includeTurns:true});turns=full.thread?.turns??[];gaps.push('Turn pagination unavailable; used read-only full thread snapshot')}
    const events:EvidenceEvent[]=[];
    for(const turn of turns)for(const item of turn.items??[]){
      if(item.type==='reasoning')continue;let kind:EvidenceEvent['kind']|undefined,text='';
      if(item.type==='userMessage'){kind='user';text=(item.content??[]).filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n')}
      if(item.type==='agentMessage'){kind='assistant';text=item.text??''}
      if(item.type==='contextCompaction'){kind='compaction';text='Saved compaction boundary; summary may be unavailable'}
      // Tool text can contain secret-file output; do not export it from this schema.
      if(['commandExecution','fileChange','mcpToolCall'].includes(item.type)){kind='tool-result';text=`${item.type}: ${item.status??'unknown'}; output omitted from app-server adapter`;}
      if(kind)events.push({id:item.id??hashText(JSON.stringify(item)),at:'',kind,text:redact(text).slice(0,12000),paths:[],status:item.status,source:{file:`codex-thread:${id}`,line:0,sha256:hashText(JSON.stringify(item))}});
    }
    gaps.push('App-server evidence has no local source-byte hash; use local rollout export for independently verifiable import');
    return {schema:1,session:this.meta(t),events:events.slice(cursor,cursor+limit),sources:[],gaps,next_cursor:cursor+limit<events.length?cursor+limit:null,total_events:events.length};
  }
}

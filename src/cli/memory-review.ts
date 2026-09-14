import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {memoryTrust, type MemoryApproval} from '../hooks/trusted-memory.js';
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
/** Read-only review document. Editing this candidate never grants trust. */
export function reviewMemory(root: string) {
  root = fs.realpathSync(root);
  const wolf = path.join(root,'.wolf');
  const documents: MemoryApproval['documents'] = {};
  for (const name of ['cerebrum.md','identity.md','OPENWOLF.md']) {
    const file = path.join(wolf,name);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file,'utf8');
    documents[name] = {content,sha256:hash(content),source:file};
  }
  const trust = memoryTrust(root);
  return {version:1,roots:[root],documents,trust:{status:trust.status,reason:trust.reason}};
}
/** Must be executed by a human administrator using an independently protected
 * installation. Coders cannot run this successfully as their ordinary user.
 */
export function approveMemory(candidateFile: string, reviewer: string, store: string) {
  if (!process.getuid || process.getuid() !== 0) throw new Error('Approval requires a separate administrator account and a managed harness. No approval was written.');
  if (!reviewer.trim()) throw new Error('Named reviewer required');
  const candidate = JSON.parse(fs.readFileSync(candidateFile,'utf8'));
  if (candidate.version !== 1 || !Array.isArray(candidate.roots) || !candidate.roots.length || !candidate.documents) throw new Error('Invalid review document');
  const roots = candidate.roots.map((r: string) => fs.realpathSync(r));
  const documents: MemoryApproval['documents'] = {};
  for (const [name,value] of Object.entries(candidate.documents)) {
    const d = value as MemoryApproval['documents'][string];
    if (!/^[\w.-]+\.md$/.test(name) || typeof d.content !== 'string' || d.content.length > 1024*1024 || hash(d.content) !== d.sha256 || typeof d.source !== 'string') throw new Error('Candidate checksum or schema mismatch');
    documents[name] = d;
  }
  store = path.resolve(store);
  // Refuse symlinks and directories writable by the agent, including ancestors.
  fs.mkdirSync(store,{recursive:true,mode:0o755});
  let current = store;
  for (;;) {
    const st = fs.lstatSync(current);
    if (st.isSymbolicLink() || st.uid !== 0 || (st.mode & 0o022)) throw new Error('Approval store must have root-owned, non-writable ancestors');
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  const approval: MemoryApproval = {version:1,roots,documents,approved_by:reviewer,approved_at:new Date().toISOString(),deployment:'managed-harness'};
  for (const root of roots) {
    const dest = path.join(store,hash(root)+'.json');
    delete approval.supersedes;
    if(fs.existsSync(dest)){const prior=fs.readFileSync(dest,'utf8');const history=path.join(store,'history');fs.mkdirSync(history,{recursive:true,mode:0o755});try{fs.writeFileSync(path.join(history,hash(prior)+'.json'),prior,{flag:'wx',mode:0o644})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e}approval.supersedes=hash(prior);}
    const tmp = dest + '.' + crypto.randomUUID() + '.tmp';
    try {
      const fd = fs.openSync(tmp,'wx',0o644);
      try {fs.writeFileSync(fd,JSON.stringify(approval,null,2));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
      fs.renameSync(tmp,dest);
    } finally {try {fs.unlinkSync(tmp);} catch {}}
  }
}

/** Revocation is an administrator operation, never a transcript-derived action. */
export function revokeMemory(root:string,reviewer:string,store:string){
  if(!process.getuid||process.getuid()!==0)throw Error('Revocation requires the independent administrator');
  if(!reviewer.trim())throw Error('Named reviewer required');
  root=fs.realpathSync(root);store=path.resolve(store);
  for(let p=store;;p=path.dirname(p)){const st=fs.lstatSync(p);if(st.isSymbolicLink()||st.uid!==0||(st.mode&0o022))throw Error('Protected store required');if(path.dirname(p)===p)break}
  const file=path.join(store,hash(root)+'.json'),old=fs.readFileSync(file,'utf8'),approval=JSON.parse(old) as MemoryApproval;
  if(approval.version!==1||!approval.roots.includes(root))throw Error('Invalid approval snapshot');
  const history=path.join(store,'history');fs.mkdirSync(history,{recursive:true,mode:0o755});
  try{fs.writeFileSync(path.join(history,hash(old)+'.json'),old,{flag:'wx',mode:0o644})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e}
  approval.revoked_by=reviewer;approval.revoked_at=new Date().toISOString();
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';try{const fd=fs.openSync(tmp,'wx',0o644);try{fs.writeFileSync(fd,JSON.stringify(approval,null,2));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(tmp,file)}finally{try{fs.unlinkSync(tmp)}catch{}}
  return {root,revoked_by:reviewer,revoked_at:approval.revoked_at};
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {projectIdentity} from '../utils/project-identity.js';
import {hashText,sensitivePath} from '../hooks/handoff-state.js';
import type {RepoSnapshot} from './types.js';
export function repoSnapshot(root:string):RepoSnapshot {
  const identity=projectIdentity(root),gaps:string[]=[];
  const git=(args:string[])=>execFileSync('git',['-c','core.fsmonitor=false',...(args[0]==='diff'?['diff','--no-ext-diff','--no-textconv',...args.slice(1)]:args)],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000,maxBuffer:16*1024*1024});
  let head:string|null=null,dirty_paths:string[]=[],diff='';
  try {
    head=git(['rev-parse','HEAD']).trim();
    const paths=[...git(['diff','--name-only','-z']).split('\0'),...git(['diff','--cached','--name-only','-z']).split('\0'),...git(['ls-files','--others','--exclude-standard','-z']).split('\0')];
    dirty_paths=[...new Set(paths.filter(p=>p&&!p.startsWith('.wolf/')))].sort();
    // Hash Git diffs without storing their potentially private content.
    diff=hashText(git(['diff','--binary','HEAD','--','.',':(exclude).wolf']));
    const observed:string[]=[];
    for(const p of dirty_paths.slice(0,1000)){
      const file=path.join(root,p);try{const stat=fs.lstatSync(file);if(stat.isSymbolicLink()){observed.push(p+':symlink:'+fs.readlinkSync(file));continue}if(!stat.isFile()||stat.size>8*1024*1024){gaps.push('Some dirty files exceed the snapshot limit');continue}observed.push(p+':'+createHash('sha256').update(fs.readFileSync(file)).digest('hex'))}catch{observed.push(p+':deleted-or-unavailable')}
    }
    if(dirty_paths.length>1000)gaps.push('Dirty-path snapshot capped at 1000 files');
    diff=hashText(diff+'\n'+observed.join('\n'));
    if(git(['rev-parse','HEAD']).trim()!==head)gaps.push('HEAD changed during repository snapshot');
  }catch{gaps.push('Git snapshot unavailable or exceeded limits')}
  return {root:identity.root,repository_id:identity.repository_id,worktree_id:identity.worktree_id,branch:identity.branch,head,dirty_paths:dirty_paths.map(p=>sensitivePath(p)?'[sensitive path omitted]':p),diff_hash:diff,gaps};
}

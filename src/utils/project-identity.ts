import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
export function projectIdentity(root: string) {
  root=fs.realpathSync(root);
  let common=root, branch: string | null=null;
  try {common=fs.realpathSync(execFileSync('git',['rev-parse','--path-format=absolute','--git-common-dir'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000}).trim());} catch {}
  try {branch=execFileSync('git',['symbolic-ref','--short','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000}).trim();} catch {}
  const hash=(s:string)=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
  return {root,repository_id:hash(common),worktree_id:hash(root),git_common_dir:common,branch};
}
export function daemonName(root:string):string {
  const identity=projectIdentity(root);
  return `openwolf-${path.basename(identity.root).replace(/[^a-zA-Z0-9._-]/g,'-')}-${identity.worktree_id}`;
}

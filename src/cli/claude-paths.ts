import * as fs from 'node:fs';
import * as path from 'node:path';
/** #23 @nathanlong85: honor explicit locations and existing .claude/CLAUDE.md. */
export function claudePaths(root: string) {
  let cfg: any = {};
  try {cfg=JSON.parse(fs.readFileSync(path.join(root,'.wolf','config.json'),'utf8'))?.openwolf?.claude ?? {};} catch {}
  const resolve=(value: unknown,fallback:string)=>{
    const target=path.resolve(root,typeof value==='string' && value ? value : fallback);
    const rel=path.relative(root,target);
    if (rel==='..' || rel.startsWith('..'+path.sep) || path.isAbsolute(rel)) throw new Error('Claude integration paths must stay inside the project');
    let ancestor=target;
    while (!fs.existsSync(ancestor)) ancestor=path.dirname(ancestor);
    const realRel=path.relative(fs.realpathSync(root),fs.realpathSync(ancestor));
    if (realRel==='..' || realRel.startsWith('..'+path.sep) || path.isAbsolute(realRel)) throw new Error('Claude integration path follows a symlink outside the project');
    return target;
  };
  return {
    settings:resolve(cfg.settings_file,'.claude/settings.json'),
    rules:resolve(cfg.rules_dir,'.claude/rules'),
    instructions:resolve(cfg.instructions_file,fs.existsSync(path.join(root,'.claude','CLAUDE.md'))?'.claude/CLAUDE.md':'CLAUDE.md'),
  };
}

import * as path from 'node:path';
import * as fs from 'node:fs';
import {lookupDaemonPid} from './daemon-pidfile.js';
/** PM2 acknowledgement is not readiness. Verify ownership and authenticated identity. */
export async function waitDaemonReady(root:string,timeout=5000):Promise<boolean> {
  const wolf=path.join(root,'.wolf');const deadline=Date.now()+timeout;
  while(Date.now()<deadline) {
    const {status,record}=lookupDaemonPid(wolf,root);
    if(status==='owned' && record) {
      try {
        const token=fs.readFileSync(path.join(wolf,'dashboard-token'),'utf8').trim();
        const res=await fetch(`http://127.0.0.1:${record.port}/api/project`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(500)});
        const project=await res.json() as {root?:string};
        if(res.ok && project.root && fs.realpathSync(project.root)===fs.realpathSync(root)) return true;
      }catch{}
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  return false;
}

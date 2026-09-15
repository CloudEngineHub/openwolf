import React,{useEffect,useState} from 'react';
import {dashboardFetch} from '../../lib/wolf-client.js';
interface Activity {mode:string;history:Array<{id:string;text:string;at:number;agent:string;count:number;operation:string;evidence:string}>;counts:Record<string,number>;updates:{installed:string;selected?:string;status?:string;latest?:string};diagnostics:string[];}
export function OpenWolfActivity(){
  const [data,setData]=useState<Activity|null>(null),[error,setError]=useState(false);
  useEffect(()=>{let alive=true,busy=false;const refresh=async()=>{if(busy)return;busy=true;try{const res=await dashboardFetch('/api/activity');if(!res.ok)throw Error();const value=await res.json();if(alive){setData(value);setError(false)}}catch{if(alive)setError(true)}finally{busy=false}};void refresh();const timer=setInterval(refresh,15000);return()=>{alive=false;clearInterval(timer)}},[]);
  return <section className="wd-card p-5 space-y-3" aria-label="OpenWolf activity">
    <div className="flex items-center justify-between gap-3"><span className="wd-label">OpenWolf activity</span><span className="wd-label">{data?.mode??'loading'}</span></div>
    <p className="text-sm">{data?.history.at(-1)?.text??'Useful actions appear here as they complete.'}</p>
    {error&&<p className="text-sm" role="status">Activity refresh unavailable; showing the last received state.</p>}
    {data&&<><div className="flex flex-wrap gap-3 text-xs" style={{color:'var(--text-muted)'}}><span>Installed {data.updates.installed}</span><span>{data.updates.selected?`Ready ${data.updates.selected}`:data.updates.status??'Update check pending'}</span><span>{Object.values(data.counts).reduce((n,c)=>n+c,0)} recorded actions</span></div>
      <details className="text-sm"><summary className="cursor-pointer">Recent actions and diagnostics</summary>
        <p className="mt-2 text-xs" style={{color:'var(--text-muted)'}}>Completed operations recorded by OpenWolf. These counts are not token savings or proof of display in the agent.</p>
        <ul className="mt-3 space-y-2">{data.history.slice(-12).reverse().map(r=><li key={r.id}><span>{r.text}</span><span className="block text-xs" style={{color:'var(--text-muted)'}}>{new Date(r.at).toLocaleString()} · {r.agent}</span></li>)}</ul>
        {data.diagnostics.map(d=><p className="mt-2 text-xs" key={d}>{d}</p>)}
      </details></>}
  </section>;
}

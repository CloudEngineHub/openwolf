import React,{useCallback,useEffect,useState} from 'react';
import {dashboardFetch} from '../../lib/wolf-client.js';
interface Session {agent:'claude'|'codex';id:string;title:string;updated_at:string;sidechain:boolean}
interface Active {agent:string;session:string;objective:string;next_action:string;unresolved:string[];completed:string[];updated_at:string;compactions:number;injections:Array<{hash:string;at:string;bytes:number}>;coverage:string[]}
interface Summary {packets:Array<{id:string;from:string;to:string;session:string;created_at:string;branch:string|null;gaps:number}>;active:Active[];operations:{checks:Array<{name:string;status:string;detail:string}>;automatic_import:boolean}}
async function api(url:string,body?:unknown){const response=await dashboardFetch(url,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw new Error(value.error??'Handover request failed');return value}
export function Handover(){
 const [summary,setSummary]=useState<Summary|null>(null),[sessions,setSessions]=useState<Session[]>([]),[source,setSource]=useState(''),[destination,setDestination]=useState<'claude'|'codex'>('codex');
 const [target,setTarget]=useState(''),[inspection,setInspection]=useState<any>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[results,setResults]=useState<any[]>([]);
 const refresh=useCallback(async()=>{try{setSummary(await api('/api/handoff'))}catch(e){setError(String(e))}},[]);
 const discover=useCallback(async()=>{try{const r=await api('/api/handoff/sessions');setSessions(r.sessions);if(r.gaps?.length)setMessage(r.gaps.join(' · '))}catch(e){setError(String(e))}},[]);
 useEffect(()=>{void refresh();void discover();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer)},[refresh,discover]);
 const act=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await fn();await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}};
 const selected=sessions.find(s=>`${s.agent}:${s.id}`===source);
 return <div className="space-y-5 text-sm [&_button]:rounded-md [&_button]:border [&_button]:px-3 [&_button]:py-2 [&_button]:cursor-pointer [&_button:disabled]:opacity-40 [&_button:disabled]:cursor-default [&_summary]:cursor-pointer [&_select]:max-w-sm [&_select]:truncate">
  <div><h2 className="text-xl font-semibold">Handover & memory</h2><p>Continue from saved evidence. Imports target one session and never approve project rules.</p></div>
  {error&&<p role="alert" className="text-red-400">{error}</p>}{message&&<p role="status">{message}</p>}
  <section className="wd-card p-4 space-y-3">
   <h3 className="font-semibold">Transfer saved context</h3>
   <div className="flex flex-wrap gap-3">
    <label>Source session <select aria-label="Source session" className="bg-transparent border rounded p-2" value={source} onChange={e=>{setSource(e.target.value);setInspection(null);setDestination(e.target.value.startsWith('claude:')?'codex':'claude')}}><option value="">Select a session</option>{sessions.map(s=><option key={`${s.agent}:${s.id}`} value={`${s.agent}:${s.id}`}>{s.agent} · {s.title} {s.sidechain?'· subagent':''}</option>)}</select></label>
    <label>Destination <select className="bg-transparent border rounded p-2" value={destination} onChange={e=>setDestination(e.target.value as 'claude'|'codex')}><option value="codex">Codex</option><option value="claude">Claude</option></select></label>
    <button disabled={busy} onClick={()=>void discover()}>Refresh sessions</button>
    <button disabled={busy||!selected} onClick={()=>void act(async()=>{await api("/api/handoff/recover",{from:selected!.agent,session:selected!.id});setMessage("Saved observations recovered and indexed. No model call was made.")})}>Recover checkpoints</button>
    <button disabled={busy||!selected} onClick={()=>void act(async()=>{const r=await api('/api/handoff/export',{from:selected!.agent,session:selected!.id,to:destination});setInspection(await api(`/api/handoff/packet/${r.id}`));setMessage('Packet saved locally. Review freshness before importing.')})}>Create packet</button>
   </div>
   {inspection&&<div className="space-y-2">
    <p>{inspection.packet.from} → {inspection.packet.to} · {inspection.packet.repo.branch??'Detached / unavailable branch'} · {inspection.packet.repo.head?.slice(0,12)??'HEAD unavailable'}</p>
    <p>{inspection.drift?'Repository changed — validation is stale':'Repository matches packet'} · {inspection.source_verifiable&&inspection.claims_verified?'Saved source and claims match':'Source or evidence claims could not be verified'}</p>
    <p>Packet size: ~{inspection.packet.estimated_tokens} estimated tokens · {inspection.packet.omitted_events} events omitted</p>
    <p>{inspection.packet.objective?.text??'No saved user objective available'}</p>
    <details><summary>Coverage and saved evidence</summary><ul>{inspection.packet.gaps.map((g:string,i:number)=><li key={i}>{g}</li>)}</ul>{inspection.packet.events.map((e:any)=><div key={e.id} className="border-t py-2"><strong>{e.kind}</strong><pre className="whitespace-pre-wrap break-words text-sm">{e.text}</pre><small>{e.source.file}:{e.source.line} · {e.id}</small></div>)}</details>
    <label>Receiving session ID <input className="bg-transparent border rounded p-2" value={target} onChange={e=>setTarget(e.target.value)} placeholder="Exact Claude or Codex session ID" /></label>
    <button disabled={busy||!target.trim()||inspection.drift||!inspection.same_worktree||!inspection.source_verifiable||!inspection.claims_verified} onClick={()=>void act(async()=>{await api('/api/handoff/import',{id:inspection.id,to:inspection.packet.to,session:target});setMessage('Evidence imported. The receiving session gets a bounded update at its next supported context hook.')})}>Import into this session</button>
   </div>}
   <details><summary>Saved packets ({summary?.packets.length??0})</summary>{summary?.packets.map(p=><button key={p.id} className="block py-1" disabled={busy} onClick={()=>void act(async()=>setInspection(await api(`/api/handoff/packet/${p.id}`)))}>{p.from} → {p.to} · {p.created_at} · {p.branch??'no branch'} · {p.id.slice(0,10)}</button>)}</details>
  </section>
  <section className="wd-card p-4 space-y-3"><h3 className="font-semibold">Active memory</h3>
   {!summary?.active.length&&<p>No checkpoints yet. Session hooks capture observations; semantic checkpoints add objectives and next actions.</p>}
   {summary?.active.map(a=><details key={a.agent+':'+a.session}><summary>{a.agent} · {a.objective||a.session} · {a.updated_at||'No checkpoint time'}</summary><p>Next: {a.next_action||'Not recorded'}</p><p>Unresolved: {a.unresolved.join(' · ')||'None recorded'}</p><p>{a.compactions} compaction boundaries · {a.injections.length} recent context deliveries</p><p>{a.coverage.join(' ')}</p><details><summary>Injection history</summary>{a.injections.map((i,n)=><p key={n}>{i.at} · {i.bytes} bytes · {i.hash.slice(0,12)}</p>)}</details></details>)}
  </section>
  <section className="wd-card p-4 space-y-3"><h3 className="font-semibold">Passive evidence</h3><p>Search exported or recovered evidence by error, path or symbol. Historical outcomes may conflict; rerun validation.</p><input aria-label="Evidence search" className="bg-transparent border rounded p-2" value={query} onChange={e=>setQuery(e.target.value)} maxLength={300}/><button disabled={busy||!query.trim()} onClick={()=>void act(async()=>setResults(await api(`/api/handoff/search?q=${encodeURIComponent(query)}`)))}>Search</button>{results.map((r,i)=><div key={i}><p>{r.kind} · {r.freshness}</p><pre className="whitespace-pre-wrap break-words">{r.excerpt}</pre>{r.potential_conflict&&<p>Potentially conflicting outcomes — inspect both observations.</p>}{r.packet&&<button onClick={()=>void act(async()=>setInspection(await api(`/api/handoff/packet/${r.packet}`)))}>Inspect evidence</button>}<small> · {r.source}</small></div>)}</section>
  <section className="wd-card p-4 space-y-3"><h3 className="font-semibold">Operational readiness</h3>{summary?.operations.checks.map(c=><div key={c.name}><strong>{c.name} · {c.status}</strong><p>{c.detail}</p></div>)}<p>Automatic handover import is off. Durable instructions require independent approval.</p></section>
 </div>;
}

import {parentPort,workerData} from 'node:worker_threads';
import {listSessions,readSession,exportPacket,inspectPacket,importPacket,listPackets,listActive,checkpoint,retrieve,recoverSession,agentName} from './service.js';
import {operationStatus} from '../cli/operations.js';
async function run(){const {root,action,args={}}=workerData;switch(action){
  case 'summary':return {packets:listPackets(root),active:listActive(root),operations:operationStatus(root)};
  case 'sessions':return listSessions(root,args.agent?agentName(args.agent):undefined,args.source??'local');
  case 'read':return readSession(root,agentName(args.agent),args.session,args.cursor??0,args.limit??200,args.source??'local');
  case 'export':return exportPacket(root,agentName(args.from),args.session,agentName(args.to),{preview:args.preview===true,budget:args.budget,source:'local'});
  case 'recover':return recoverSession(root,agentName(args.from),args.session);
  case 'inspect':return inspectPacket(root,args.id);
  case 'import':return importPacket(root,args.id,agentName(args.to),args.session,args.allowDrift===true);
  case 'checkpoint':return checkpoint(root,agentName(args.agent),args.session,args.patch??{});
  case 'search':return retrieve(root,args.query??'');
  default:throw Error('Unknown handover operation');
}}
run().then(result=>parentPort?.postMessage({result})).catch(error=>parentPort?.postMessage({error:error instanceof Error?error.message:String(error)}));

import {parentPort,workerData} from 'node:worker_threads';
import {reconcileUsage} from './usage-report.js';
if (parentPort) {
  try {parentPort.postMessage({report:reconcileUsage(workerData.root)});}
  catch(error) {parentPort.postMessage({error:String(error)});}
}

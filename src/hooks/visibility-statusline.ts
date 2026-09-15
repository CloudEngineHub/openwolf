import {createHash} from 'node:crypto';
import {activityState,visibilityMode} from './visibility.js';
import {readStdin,getProjectDir} from './shared.js';
// Standalone composable segment. No ANSI, shell execution, transcript reads or network.
try {
  const input=JSON.parse(await readStdin()),root=getProjectDir();
  if(visibilityMode(root)!=='off'){
    const {state,message}=activityState(root,{agent:'claude',session:input.session_id??'',turn:input.prompt_id??'session',surface:'claude-statusline'});
    const recent=state.last&&state.last.agent==='claude'&&state.last.transport==='claude-statusline'&&state.last.session===createHash('sha256').update(input.session_id??'').digest('hex')&&Date.now()-state.last.at<300_000?state.last.text:undefined;
    if(message||recent)process.stdout.write(message??recent!);
  }
}catch{} // A status segment must never break the user's status line.

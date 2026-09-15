import type {AgentAdapter} from './types.js';
/** Grok loads the native Claude settings path. Registering it twice runs every hook twice. */
export const grokAdapter:AgentAdapter={
  name:'grok',displayName:'Grok Build',
  install(){return {actions:['Grok uses the existing Claude-compatible settings hooks; activity is available in the dashboard'],warnings:['Grok requires project hook trust and Claude compatibility enabled; no additional hooks or terminal notices are registered.']}}
};

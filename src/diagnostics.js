import { createIdentifier } from './identifiers.js';

const LOG_KEY='mc-master-diagnostics-v1';
const MAX_LOGS=500;
const modules=new Map();
let lifecycle='booting';
let lastError=null;
const diagnosticsEnabled=globalThis.__MC_DIAGNOSTICS_ENABLED===true;
const diagnosticsPersistenceEnabled=diagnosticsEnabled||globalThis.__MC_DIAGNOSTICS_PERSISTENCE_ENABLED===true;
const scheduleIdleWork=callback=>{
  if (typeof globalThis.requestIdleCallback === 'function') return globalThis.requestIdleCallback(callback, { timeout: 1000 });
  return setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 0);
};
const cancelIdleWork=handle=>{
  if (!handle) return;
  if (typeof globalThis.cancelIdleCallback === 'function') globalThis.cancelIdleCallback(handle);
  else clearTimeout(handle);
};

function safeParse(value,fallback){try{return JSON.parse(value)}catch{return fallback}}
const storage=globalThis.localStorage;
let logs=diagnosticsEnabled?safeParse(storage?.getItem?.(LOG_KEY)||'[]',[]):[];
let persistHandle=0;
function persist(){
  if (!diagnosticsPersistenceEnabled) return;
  if (persistHandle) return;
  persistHandle=scheduleIdleWork(() => {
    persistHandle=0;
    try{storage?.setItem?.(LOG_KEY,JSON.stringify(logs.slice(-MAX_LOGS)))}catch{}
  });
}
function write(level,message,details={}){
  const entry={id:createIdentifier(),time:new Date().toISOString(),level,message,details};
  if (diagnosticsEnabled) {
    logs.push(entry);
    logs = logs.slice(-MAX_LOGS);
    if (level !== 'debug' || diagnosticsPersistenceEnabled) persist();
    const fn=level==='error'?'error':level==='warning'?'warn':'log';
    console[fn](`[Mission Companion] ${message}`,details);
    window.dispatchEvent(new CustomEvent('mc:diagnostics',{detail:entry}));
  }
  return entry;
}
export const logger={
  info:(m,d)=>write('info',m,d),
  warning:(m,d)=>write('warning',m,d),
  error:(m,d)=>write('error',m,d),
  debug:(m,d)=>write('debug',m,d),
  list:()=>[...logs],
  clear:()=>{logs=[];if (persistHandle) { cancelIdleWork(persistHandle); persistHandle=0; } if (diagnosticsPersistenceEnabled) persist(); if (diagnosticsEnabled) window.dispatchEvent(new CustomEvent('mc:diagnostics'))}
};
export function setLifecycle(next,details={}){lifecycle=next;logger.info(`Lifecycle: ${next}`,details);window.dispatchEvent(new CustomEvent('mc:health'))}
export function registerModule(name,status='ready',details={}){modules.set(name,{name,status,details,checkedAt:new Date().toISOString()});window.dispatchEvent(new CustomEvent('mc:health'))}
export function moduleStatus(name,status,details={}){registerModule(name,status,details)}
export function captureError(error,context={}){
  const err=error instanceof Error?error:new Error(String(error));
  lastError={message:err.message,stack:err.stack||'',context,time:new Date().toISOString()};
  logger.error(err.message,{...context,stack:err.stack||''});
  showRecovery(lastError);
  window.dispatchEvent(new CustomEvent('mc:health'));
  return lastError;
}
function showRecovery(err){
  let banner=document.querySelector('#mcRecovery');
  if(!banner){banner=document.createElement('div');banner.id='mcRecovery';banner.className='recovery-banner';document.body.appendChild(banner)}
  banner.innerHTML=`<strong>Mission Companion recovered from an error.</strong><span>${escapeHtml(err.message)}</span><button type="button" data-recovery-details>Show details</button><button type="button" data-recovery-close>×</button>`;
  banner.querySelector('[data-recovery-close]').onclick=()=>banner.remove();
  banner.querySelector('[data-recovery-details]').onclick=()=>window.dispatchEvent(new CustomEvent('mc:open-diagnostics'));
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function verifyButtons(selectors=[]){
  const result=selectors.map(selector=>{const el=document.querySelector(selector);return {selector,present:!!el,attached:!!(el&&(el.onclick||el.onchange||el.onkeydown||el.dataset.bound==='true'))}});
  const attached=result.filter(x=>x.present&&x.attached).length;
  const missing=result.filter(x=>!x.present).map(x=>x.selector);
  const unattached=result.filter(x=>x.present&&!x.attached).map(x=>x.selector);
  registerModule('Navigation',missing.length||unattached.length?'warning':'ready',{attached,total:result.length,missing,unattached});
  return {attached,total:result.length,missing,unattached,items:result};
}
export async function runHealthChecks(engine){
  const checks=[];
  const add=(name,status,detail='')=>checks.push({name,status,detail});
  add('UI',document.querySelector('#app .shell')?'healthy':'failed',document.querySelector('#app .shell')?'Application shell loaded':'Application shell missing');
  try{const key='mc-health-test';localStorage.setItem(key,'ok');localStorage.removeItem(key);add('Storage','healthy','Local storage read/write passed')}catch(e){add('Storage','failed',e.message)}
  try{const docs=await engine.documents();const sections=await engine.sections();add('Knowledge','healthy',`${docs.length} document(s), ${sections.length} section(s)`)}catch(e){add('Knowledge','failed',e.message)}
  try{await engine.healthCheck();add('Database','healthy','IndexedDB opened successfully')}catch(e){add('Database','failed',e.message)}
  const state=engine.state();add('AI',state.settings.openaiKey?'configured':'attention',state.settings.openaiKey?'API key present':'API key not configured');
  add('Lifecycle',lifecycle==='ready'?'healthy':'attention',lifecycle);
  for(const m of modules.values())add(m.name,m.status==='ready'?'healthy':m.status,m.details?.summary||m.status);
  return {checks,lifecycle,lastError,modules:[...modules.values()],logs:logger.list()};
}
export function diagnosticSnapshot(){return {lifecycle,lastError,modules:[...modules.values()],logs:logger.list(),userAgent:navigator.userAgent,url:location.href,time:new Date().toISOString()}}
export function installGlobalHandlers(){
  window.addEventListener('error',e=>captureError(e.error||e.message,{source:e.filename,line:e.lineno,column:e.colno,type:'window.error'}));
  window.addEventListener('unhandledrejection',e=>captureError(e.reason||'Unhandled promise rejection',{type:'unhandledrejection'}));
  registerModule('Global Error Handler','ready',{summary:'Installed'});
}

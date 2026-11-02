/* Reef Command v2 — optional cloud sync. No credentials are embedded in this file. */
'use strict';
(() => {
const CFG_KEY='reef-command-supabase-config-v2';
const COLLECTIONS=['readings','tasks','activities','equipment','livestock'];
const RESERVED_SEEDS={
 tasks:['Check alkalinity','Clean display glass','Inspect skimmer cup','Inspect ReefMat roll'],
 equipment:['GHL ProfiLux 4','Red Sea ReefMat 1200','Red Sea REEFER DC Skimmer 900','D-D 80W UV','Red Sea ReefRun G2 8000','Maxspect Gyre XF350','Orphek iCon'],
 livestock:['Existing fish — species to identify','Sand-sifting starfish','Snails (various)','Hermit crabs','Bumblebee snails']
};
const clone=x=>JSON.parse(JSON.stringify(x));
const compact=x=>JSON.stringify(x);
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const stamp=x=>Number(x?._modifiedAt)||0;
const safe=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const recordsEqual=(a,b)=>{const clean=x=>{if(!x)return x;const y={...x};delete y._modifiedAt;return y;};return compact(clean(a))===compact(clean(b))};
const config=()=>{try{return JSON.parse(localStorage.getItem(CFG_KEY)||'null')}catch{return null}};
let cfg=config(),client=null,user=null,status='Cloud not configured',lastOk=null,busy=false,pending=false,manualTimer=null,realtime=null,latestGh=[],historyGh=[],historyUser=null,historyChecked=0,historyCursor=null,historyBusy=false,historyError='',liveError='';
const validConfig=c=>!!(c&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(c.url)&&/^[A-Za-z0-9_.-]{20,}$/.test(c.key));
function setStatus(s){status=s;const el=document.getElementById('saveStatus');if(el)el.textContent=s;const out=document.getElementById('cloudStatus');if(out)out.textContent=statusLabel();if(page==='dashboard'&&!document.getElementById('modalHost')?.innerHTML)render();}
function statusLabel(){return status+(historyError?' · '+historyError:'')+(lastOk?' · Last sync '+new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(lastOk):'');}
function latestCard(){if(!latestGh.length)return '<section class="panel"><div class="panelHead"><h2>GHL live feed</h2><span class="status none">No readings yet</span></div><p class="subtle">GHL measurements will appear once the Pi bridge is configured and running.</p></section>';
const now=Date.now();return `<section class="panel"><div class="panelHead"><h2>GHL measurements</h2><span class="status">Read-only</span></div><div class="metrics">${latestGh.map(x=>{const age=now-Date.parse(x.read_at),stale=!Number.isFinite(age)||age>15*60*1000||age< -60000;return `<article class="metric"><div class="metricTop"><span class="metricName">${safe(TYPES[x.metric]?.label||x.metric)}</span><span class="status ${stale?'warn':''}">${stale?'STALE':'LIVE'}</span></div><div class="metricValue">${safe(x.value)} <small>${safe(x.unit||'')}</small></div><div class="metricBottom">${safe(new Date(x.read_at).toLocaleString('en-GB'))} · ${safe(ageText(x.read_at))} · GHL</div></article>`}).join('')}</div><p class="help">Live means a reading received within 15 minutes. Automatic recordings are saved every 30 minutes; dashboard cards and trends include the last 30 days.</p></section>`}
function panel(){const connected=!!user;return `<section class="panel" id="syncPanel"><div class="panelHead"><h2>Cloud sync · Supabase</h2><span class="status ${connected?'':'none'}">${safe(connected?'Signed in':'Not signed in')}</span></div><p class="subtle">Private cloud sync across Android and Windows. Records stay available locally when offline. Only a Supabase public/publishable key is used; never paste a service-role key.</p>
<div class="settingGroup" style="max-width:700px"><label for="syncUrl">Supabase project URL</label><input class="input" id="syncUrl" type="url" value="${safe(cfg?.url||'')}" placeholder="https://xxxx.supabase.co" autocomplete="off"><label for="syncKey">Supabase publishable key (sb_publishable_… or anon key)</label><input class="input" id="syncKey" type="text" value="${safe(cfg?.key||'')}" placeholder="sb_publishable_…" autocomplete="off"><button type="button" class="btn" data-sync="configure">Save connection settings</button>
${cfg?`<p class="help" id="cloudStatus">${safe(statusLabel())}</p>`:''}
${!connected?`<label for="syncEmail">Email of your Supabase Auth user</label><input class="input" id="syncEmail" type="email" autocomplete="username"><label for="syncPassword">Password</label><input class="input" id="syncPassword" type="password" autocomplete="current-password"><button type="button" class="btn primary" data-sync="signin">Sign in and merge records</button>`:`<div class="actions"><button type="button" class="btn primary" data-sync="now">Sync now</button><button type="button" class="btn" data-sync="signout">Sign out</button></div>`}</div><p class="help">Before connecting your second device, back up the first. Sign in with the same Supabase account on both. The cloud stores your records, but not your GHL credentials.</p></section>`}
function onLocalSave(before,after){localStorage.setItem(KEY+'-pending','1');
 const t=Date.now();after._deleted=after._deleted||{};
 for(const col of COLLECTIONS){const previous=new Map((before[col]||[]).map(x=>[String(x.id),x]));const current=new Set();after._deleted[col]=after._deleted[col]||{};
 for(const r of after[col]){const k=String(r.id);current.add(k);if(!previous.has(k)||!recordsEqual(previous.get(k),r))r._modifiedAt=t;}
 for(const [k] of previous)if(!current.has(k))after._deleted[col][k]=t;
 }
 if(compact(before.settings)!==compact(after.settings)){after.settings._modifiedAt=t;}
}
function merge(a,b){
 const merged=clone(a);merged.version=1;merged._deleted={};
 for(const col of COLLECTIONS){let tomb={...(a._deleted?.[col]||{})};for(const [k,v] of Object.entries(b._deleted?.[col]||{}))tomb[k]=Math.max(Number(tomb[k])||0,Number(v)||0);
 const records=new Map();for(const [source,priority] of [[a,1],[b,2]])for(const r of source[col]||[]){const k=String(r.id);const old=records.get(k);if(!old||stamp(r)>stamp(old.r)||(stamp(r)===stamp(old.r)&&priority>old.priority))records.set(k,{r,priority});}
 // Initial seed rows are generated with random IDs on each device; deduplicate only known built-in seed labels.
 for(const name of RESERVED_SEEDS[col]||[]){const copies=[...records.entries()].filter(([_,x])=>x.r.name===name);if(copies.length>1){copies.sort((a,b)=>stamp(b[1].r)-stamp(a[1].r)||b[1].priority-a[1].priority);for(const [key] of copies.slice(1))records.delete(key);}}
 merged[col]=[...records.entries()].filter(([k,x])=>(Number(tomb[k])||0)<stamp(x.r)||(!own(tomb,k))).map(([_,x])=>clone(x.r));merged._deleted[col]=tomb;
 }
 merged.settings=clone((Number(a.settings?._modifiedAt)||0)>=(Number(b.settings?._modifiedAt)||0)?a.settings:b.settings);
 merged.created=a.created||b.created||new Date().toISOString();return merged;
}
async function ensureClient(){if(!validConfig(cfg))throw Error('Save a valid Supabase URL and publishable key first.');if(!window.supabase?.createClient)throw Error('Supabase library unavailable. Check the internet connection and reload.');if(!client){client=window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 client.auth.onAuthStateChange((_event,session)=>{const next=session?.user||null;if(next?.id!==user?.id){latestGh=[];clearHistory();}user=next;if(!next){latestGh=[];clearHistory();status='Not signed in';}else{status='Signed in · syncing';setTimeout(()=>requestSync(),100);}if(page==='settings')render();});
 const {data:{session}}=await client.auth.getSession();user=session?.user||null;
 if(user){const stamp=localStorage.getItem(KEY+'-last-sync:'+user.id);if(stamp&&Number.isFinite(Date.parse(stamp)))lastOk=new Date(stamp);subscribe();}}
 return client;
}
async function signIn(){await ensureClient();const email=document.getElementById('syncEmail')?.value?.trim();const password=document.getElementById('syncPassword')?.value;if(!email||!password)throw Error('Enter your Supabase Auth email and password.');const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;user=data.user;subscribe();await run();}
async function signOut(){if(client){if(realtime){await client.removeChannel(realtime);realtime=null;}const {error}=await client.auth.signOut();if(error)throw error;}user=null;latestGh=[];clearHistory();setStatus('Signed out · local records retained');}
function subscribe(){if(!client||!user||realtime)return;
 realtime=client.channel('reef-changes-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'reef_state',filter:'owner_id=eq.'+user.id},()=>requestSync()).on('postgres_changes',{event:'*',schema:'public',table:'ghl_latest',filter:'owner_id=eq.'+user.id},()=>fetchGh()).subscribe();}
async function fetchGh(){if(!client||!user)return;const owner=user.id;const {data,error}=await client.from('ghl_latest').select('metric,value,unit,read_at').order('metric');if(user?.id!==owner)return;if(!error){latestGh=data||[];liveError='';if(page==='dashboard')render();}else liveError='Could not refresh live readings; showing last received values.';}

function clearHistory(){historyGh=[];historyUser=null;historyChecked=0;historyCursor=null;historyError='';}
function historyReadings(){
 const units={temperature:'°C',ph:'pH',salinity:'PSU',conductivity:'mS/cm',redox:'mV',reefrun_1_flow:'L/h',uv_branch_flow:'L/h',reefrun_2_flow:'L/h'};
 return historyGh.filter(r=>own(units,r.metric)&&r.unit===units[r.metric]&&r.value!==null&&Number.isFinite(Number(r.value))&&Number.isFinite(Date.parse(r.read_at))).map(r=>({id:'ghl-'+r.id,type:r.metric,value:Number(r.value),unit:r.unit,at:r.read_at,source:'GHL',notes:'GHL · automatic recording'}));
}
async function fetchHistory(){
 if(!client||!user||historyBusy||Date.now()-historyChecked<60000)return;
 const owner=user.id,project=cfg.url;
 const cacheKey='reef-ghl-history-v1:'+project+':'+owner;
 if(historyUser!==cacheKey){
  clearHistory();historyUser=cacheKey;
  try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'[]');if(Array.isArray(cached))historyGh=cached;}catch{}
 }
 const since=new Date(Date.now()-30*86400000).toISOString();
 // Overlap the previous query to tolerate readings arriving while requests were in flight.
 const from=historyCursor?new Date(Math.max(Date.parse(since),Date.parse(historyCursor)-600000)).toISOString():since;
 const checkedAt=new Date().toISOString();
 historyBusy=true;
 try{
  let incoming=[];
  for(let offset=0;offset<20000;offset+=1000){
   const {data,error}=await client.from('ghl_history').select('id,metric,value,unit,read_at,sample_hour').eq('owner_id',owner).gte('read_at',from).order('read_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+999);
   if(error)throw error;
   incoming.push(...(data||[]));if((data||[]).length<1000)break;
   if(offset===19000)throw Error('History exceeds display limit');
  }
  if(user?.id!==owner||cfg.url!==project)return;
  const joined=new Map(historyGh.map(r=>[String(r.id),r]));
  for(const row of incoming)joined.set(String(row.id),row);
  historyGh=[...joined.values()].filter(r=>Date.parse(r.read_at)>=Date.parse(since));
  historyCursor=checkedAt;historyChecked=Date.now();historyError='';
  try{localStorage.setItem(cacheKey,JSON.stringify(historyGh));}catch{}
 }catch(e){historyError='GHL history unavailable; retrying';console.error('GHL history:',e);historyChecked=Date.now();}
 finally{historyBusy=false;if(page==='dashboard'||page==='chemistry')render();}
}
async function run(){if(busy){pending=true;return;}if(!navigator.onLine||!user||!client){setStatus(user?'Offline · records saved locally':'Local only · sign in to sync');return;}busy=true;try{
 setStatus('Synchronising…');
 let syncedState=null;for(let attempt=0;attempt<4;attempt++){
  const {data:remote,error:readError}=await client.from('reef_state').select('revision,data').eq('owner_id',user.id).maybeSingle();if(readError)throw readError;
  const joined=remote?merge(db,remote.data):clone(db);
  if(remote&&canonical(joined)===canonical(remote.data)){if(canonical(db)!==canonical(joined))cloudApply(joined);syncedState=clone(joined);break;}
  const {data:result,error:writeError}=await client.rpc('reef_write_snapshot',{p_expected_rev:remote?.revision||0,p_data:joined});if(writeError)throw writeError;
  if(result?.ok){const final=merge(db,joined);if(canonical(db)!==canonical(final))cloudApply(final);syncedState=clone(joined);break;}
  if(attempt===3)throw Error('Sync conflict after retries. No local data was lost.');
 }
 lastOk=new Date();localStorage.setItem(KEY+'-last-sync:'+user.id,lastOk.toISOString());if(syncedState&&canonical(syncedState)===canonical(db))localStorage.removeItem(KEY+'-pending');setStatus('Cloud synced');await fetchGh();await fetchHistory();
 }catch(e){console.error('Reef Cloud sync:',e);setStatus('Sync pending: '+String(e.message||e).slice(0,95));}finally{busy=false;const health=document.getElementById('healthPanel');if(health)health.outerHTML=connectionHealth();if(pending){pending=false;setTimeout(()=>run(),1200)}}}
function requestSync(){if(manualTimer)clearTimeout(manualTimer);manualTimer=setTimeout(()=>{if(user)run();},850);}
async function handle(el){const action=el.dataset.sync;try{
 if(action==='configure'){const url=document.getElementById('syncUrl').value.trim().replace(/\/$/,'');const key=document.getElementById('syncKey').value.trim();if(!validConfig({url,key}))throw Error('Enter a valid https://...supabase.co URL and publishable/anon key.');if(client&&user)await signOut();cfg={url,key};localStorage.setItem(CFG_KEY,JSON.stringify(cfg));client=null;await ensureClient();setStatus('Connection settings saved · sign in');}
 if(action==='signin')await signIn();if(action==='now')await run();if(action==='signout')await signOut();
 }catch(e){console.error(e);alert('Cloud: '+(e.message||e));}}
document.addEventListener('click',e=>{const el=e.target.closest('[data-sync]');if(el)handle(el);});
window.addEventListener('online',()=>requestSync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestSync()});
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue&&e.newValue!==compact(db)){try{cloudApply(JSON.parse(e.newValue))}catch{}}});
window.ReefSync={onLocalSave,requestSync,statusLabel,settingsPanel:panel,ghlDashboard:latestCard,isConnected:()=>!!user,diagnostics:()=>({signedIn:!!user,pending:!!localStorage.getItem(KEY+'-pending'),busy,lastSync:lastOk?.toISOString()||null,live:latestGh.map(x=>({...x})),historyError,liveError}), historyReadings, _test:{merge,canonical,historyReadings,fetchHistory}};
setInterval(()=>{if(user&&!document.hidden)run()},25000);
if(cfg){ensureClient().then(()=>{if(user){setStatus('Cloud connected');subscribe();run();}else setStatus('Not signed in');}).catch(e=>setStatus('Cloud setup required: '+e.message));}
})();


/* Reef Command v2 — local-first records, optional authenticated sync. */
'use strict';
const KEY='reef-command-data-v1';
const TYPES={
  temperature:{label:'Temperature',unit:'°C',min:24,max:26,step:'.1'},
  salinity:{label:'Salinity',unit:'ppt',min:34,max:36,step:'.1'},
  ph:{label:'pH',unit:'',min:7.9,max:8.4,step:'.01'},
  alkalinity:{label:'Alkalinity',unit:'dKH',min:7.5,max:9,step:'.1'},
  calcium:{label:'Calcium',unit:'ppm',min:400,max:460,step:'1'},
  magnesium:{label:'Magnesium',unit:'ppm',min:1250,max:1400,step:'1'},
  nitrate:{label:'Nitrate (NO₃)',unit:'ppm',min:2,max:20,step:'.1'},
  phosphate:{label:'Phosphate (PO₄)',unit:'ppm',min:.02,max:.1,step:'.001'},
  ammonia:{label:'Ammonia (NH₃/NH₄)',unit:'ppm',min:0,max:0,step:'.01'},
  nitrite:{label:'Nitrite (NO₂)',unit:'ppm',min:0,max:0,step:'.01'},
  redox:{label:'Redox',unit:'mV',min:200,max:450,step:'1'},
  conductivity:{label:'Conductivity',unit:'mS/cm',min:0,max:100,step:'.001'},
  reefrun_1_flow:{label:'ReefRun 1 flow',unit:'L/h',min:0,max:10000,step:'1'},
  uv_branch_flow:{label:'UV branch flow',unit:'L/h',min:0,max:10000,step:'1'},
  reefrun_2_flow:{label:'ReefRun 2 flow',unit:'L/h',min:0,max:10000,step:'1'},
  flow:{label:'Flow',unit:'L/h',min:0,max:10000,step:'1'}
};
const NAV=[['dashboard','Overview','◈'],['chemistry','Measurements','⌁'],['maintenance','Maintenance','▤'],['equipment','Equipment','▣'],['livestock','Livestock','◇'],['settings','Settings','⚙']];
function localDate(d=new Date()){const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,10)}
function localDateTime(d=new Date()){const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,16)}
function parseDate(v){return new Date((v||'').length===10?v+'T12:00:00':v)}
function formatDate(v){if(!v)return 'Not recorded';const d=parseDate(v);return Number.isNaN(+d)?'Invalid date':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(d)}
function formatShort(v){if(!v)return '—';const d=parseDate(v);return Number.isNaN(+d)?'—':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'}).format(d)}
function daysBetween(a,b){return Math.round((parseDate(b)-parseDate(a))/86400000)}
function afterDays(date,n){const d=parseDate(date||localDate());d.setDate(d.getDate()+Number(n||0));return localDate(d)}
function nfmt(n){return Number(n).toLocaleString('en-GB',{maximumFractionDigits:3})}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function attr(value){return esc(value)}
function id(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36)}

const SERVICE_SCHEDULE=[
 ['reefmat-check','Check ReefMat roll and advancement',1,'Check fleece remaining, normal advancement, water level and alerts. Replace the roll when used up, not by calendar.'],
 ['reefmat-clean','Clean ReefMat sensor and inspect rollers',30,'Clean the level sensor and inspect rollers, filter grids and inlet. Keep the drive unit dry.'],
 ['skimmer-cup','Clean skimmer cup and neck',4,'Starting interval approximates twice weekly. Empty sooner if filling quickly; adjust to actual skimmate production.'],
 ['skimmer-pump','Inspect and clean skimmer pump and air intake',30,'Inspect pump/needle wheel, venturi, air hose and silencer. Remove deposits when needed using the equipment instructions.'],
 ['return1-check','Check ReefRun 1 intake and flow',7,'Compare flow at unchanged speed and valve settings. Record a clean-system baseline; investigate a sustained fall.'],
 ['return2-check','Check ReefRun 2 intake and flow',7,'Compare flow at unchanged speed and valve settings. Record a clean-system baseline; investigate a sustained fall.'],
 ['return1-clean','Service ReefRun 1 pump',90,'Clean rotor, housing and intake; inspect seals. Red Sea recommends cleaning every 3 months or sooner if flow drops. Stagger service with ReefRun 2.'],
 ['return2-clean','Service ReefRun 2 pump',90,'Clean rotor, housing and intake; inspect seals. Set a different due date from ReefRun 1 so both pumps are not serviced together.'],
 ['gyre-check','Inspect Maxspect Gyres',30,'Inspect cages and output for fouling, noise and reduced circulation.'],
 ['gyre-clean','Clean Maxspect Gyres',90,'Conservative starting interval. Clean cages, rotors and bearings as instructed; reassemble the correct sides. The 300-series manual gives 6 months or as necessary.'],
 ['uv-flow','Check UV branch flow and leaks',7,'Compare branch flow against the clean-system baseline at the same settings. Inspect connections for leaks.'],
 ['uv-sleeve','Clean D-D UV quartz sleeve and inspect seals',180,'D-D guidance: clean sleeve at approximately 6 months. Disconnect UV power before opening; follow the manual and leak-test after reassembly. Never inspect an illuminated exposed lamp.'],
 ['uv-lamp','Replace D-D UV lamp',365,'D-D guidance: approximately 9000 operating hours / 1 year. Set the first due date from the actual lamp installation date; glowing does not prove adequate UV output.'],
 ['probes-clean','Inspect and gently clean GHL probes',30,'Use the cleaning method appropriate to each probe. Keep pH/redox sensing tips wet; do not scrub sensitive surfaces.'],
 ['probe-ph','Check GHL pH probe against standards',30,'Use fresh reference buffers following GHL instructions; recalibrate if needed. This is a proposed monthly check, not a mandatory monthly calibration.'],
 ['probe-conductivity','Check GHL conductivity/salinity probe',30,'Check against fresh conductivity standard with correct temperature compensation, following GHL instructions; calibrate if needed.'],
 ['probe-redox','Check GHL redox probe against reference',30,'Check against the correct redox reference solution and follow GHL instructions if it does not agree.'],
 ['flow-check','Inspect all three flow sensor readings',30,'Check ReefRun 1, UV branch and ReefRun 2 against their baselines at unchanged pump/valve settings.'],
 ['flow-clean','Inspect and clean three flow sensors',90,'Inspect for deposits while servicing associated plumbing/pumps; clean according to the sensor instructions. Do not alter calibration factors just to match an expected flow.'],
 ['lights-clean','Clean and inspect Orphek iCon lights',30,'Disconnect power. Remove external dust and salt deposits; inspect fan openings, mounts and cables. Keep liquids out of the fixture.'],
 ['controller-check','Check ProfiLux alarms, clock and connections',30,'Inspect ventilation, connections, clock and configured alarms without disturbing aquarium control.'],
 ['controller-backup','Back up ProfiLux configuration',90,'Save a configuration backup. Also back up before configuration changes or firmware work.']
];
function ensureServiceSchedule(state){
 if(Number(state.settings.serviceScheduleVersion)>=1)return false;
 const now=Date.now();
 const names=new Set(state.tasks.map(t=>t.name.trim().toLowerCase()));
 const ids=new Set(state.tasks.map(t=>t.id));
 for(const [key,name,interval,notes] of SERVICE_SCHEDULE){
  const taskId='reef-service-v1-'+key;
  if(ids.has(taskId)||names.has(name.toLowerCase())||state._deleted?.tasks?.[taskId])continue;
  state.tasks.push({id:taskId,name,interval,next:localDate(),last:'',complete:false,notes,servicePlan:true,_modifiedAt:now});
 }
 state.settings.serviceScheduleVersion=1;
 state.settings._modifiedAt=now;
 return true;
}

function baseline(){return {
  version:1,created:new Date().toISOString(), settings:{name:'700L Mixed Reef',volume:700,targets:Object.fromEntries(Object.entries(TYPES).map(([k,v])=>[k,{min:v.min,max:v.max}]))},
  readings:[],
  tasks:[
   {id:id(),name:'Check alkalinity',interval:3,next:afterDays(localDate(),3),last:'',notes:''},
   {id:id(),name:'Clean display glass',interval:7,next:afterDays(localDate(),7),last:'',notes:''},
   {id:id(),name:'Inspect skimmer cup',interval:7,next:afterDays(localDate(),7),last:'',notes:''},
   {id:id(),name:'Inspect ReefMat roll',interval:14,next:afterDays(localDate(),14),last:'',notes:''}
  ],
  equipment:[
   ['GHL ProfiLux 4','Monitoring',1],['Red Sea ReefMat 1200','Filtration',1],['Red Sea REEFER DC Skimmer 900','Filtration',1],['D-D 80W UV','Sterilisation',1],['Red Sea ReefRun G2 8000','Return pump',2],['Maxspect Gyre XF350','Circulation',2],['Orphek iCon','Lighting',3]
  ].map(([name,category,quantity])=>({id:id(),name,category,quantity,installed:'',service:0,last:'',notes:''})),
  livestock:[
   {id:id(),name:'Existing fish — species to identify',kind:'Fish',quantity:13,status:'current',added:'',notes:'Approximate transferred fish count from mid-October 2026; replace this aggregate with individual species records.'},
   {id:id(),name:'Sand-sifting starfish',kind:'Invertebrate',quantity:1,status:'current',added:'',notes:'Transferred mid-October 2026.'},
   {id:id(),name:'Snails (various)',kind:'Invertebrate',quantity:null,status:'current',added:'',notes:'Transferred mid-October 2026. Quantity unknown; update when counted.'},
   {id:id(),name:'Hermit crabs',kind:'Invertebrate',quantity:2,status:'current',added:'',notes:'Approximate count; transferred mid-October 2026.'},
   {id:id(),name:'Bumblebee snails',kind:'Invertebrate',quantity:null,status:'current',added:'',notes:'Transferred mid-October 2026. Quantity unknown; update when counted.'}
  ],
  activities:[]
}}
function load(){try{const raw=localStorage.getItem(KEY);if(!raw)return baseline();const obj=JSON.parse(raw);if(!valid(obj))throw Error('Invalid backup');return obj}catch(err){console.warn('Could not load stored data:',err);window.__storageError=true;return baseline()}}
function valid(s){return s&&s.version===1&&s.settings&&Array.isArray(s.readings)&&Array.isArray(s.tasks)&&Array.isArray(s.equipment)&&Array.isArray(s.livestock)&&Array.isArray(s.activities)}
let db=load(),page='dashboard',metric='temperature',livestockFilter='all',taskFilter='due',modalOrigin=null;
let lastSavedState=JSON.parse(JSON.stringify(db));
function cloudApply(state){if(!valid(state))return false;db=state;const scheduleAdded=ensureServiceSchedule(db);try{localStorage.setItem(KEY,JSON.stringify(db));lastSavedState=JSON.parse(JSON.stringify(db));render();if(scheduleAdded)window.ReefSync?.requestSync();return true}catch(err){console.error('Cloud apply failed',err);return false}}
function save(){try{window.ReefSync?.onLocalSave(lastSavedState,db);localStorage.setItem(KEY,JSON.stringify(db));lastSavedState=JSON.parse(JSON.stringify(db));const x=document.getElementById('saveStatus');if(x)x.textContent='Saved locally · Cloud pending';window.ReefSync?.requestSync();return true}catch(e){alert('Saving failed. Storage may be full or blocked. Please export a backup before closing this page.');return false}}
function recordedReadings(){return [...db.readings,...(window.ReefSync?.historyReadings()||[])]}
function readingSource(r){return ['GHL','Aquarimate'].includes(r.source)?r.source:'Manual'}
function readingDate(r){return r.at?.includes('T')?new Date(r.at).toLocaleString('en-GB'):formatDate(r.at)}
function latest(type){return recordedReadings().filter(r=>r.type===type).sort((a,b)=>String(b.at).localeCompare(String(a.at)))[0]}
function badge(value,type){if(value===null||value===undefined)return '<span class="status none">No data</span>';const v=Number(value),t=db.settings.targets?.[type]||TYPES[type];if(v<t.min||v>t.max)return '<span class="status warn">Outside target</span>';return '<span class="status">On target</span>'}
function unit(type){return TYPES[type]?.unit||''}
function target(type){const x=db.settings.targets?.[type]||TYPES[type];return `${nfmt(x.min)}–${nfmt(x.max)} ${unit(type)}`.trim()}
function heading(title,subtitle,actions=''){return `<div class="pageTitle"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${actions?`<div class="actions">${actions}</div>`:''}</div>`}
function button(label,action,primary=false,additional=''){return `<button type="button" class="btn ${primary?'primary':''}" data-action="${esc(action)}" ${additional}>${esc(label)}</button>`}
function empty(label,desc){return `<div class="empty"><b>${esc(label)}</b>${esc(desc)}</div>`}
function mark(val){return val==null?'—':esc(val)}
function cards(){return ['temperature','salinity','ph','alkalinity','nitrate','phosphate'].map(type=>{const r=latest(type),t=TYPES[type];return `<article class="metric"><div class="metricTop"><span class="metricName">${esc(t.label)}</span>${badge(r?.value,type)}</div><div class="metricValue">${r?nfmt(r.value):'—'} <small>${esc(r?.unit??t.unit)}</small></div><div class="metricBottom">${r?esc(readingSource(r))+' · '+readingDate(r):'No reading recorded'}</div></article>`}).join('')}

function taskIsDue(t){return !t.complete&&!!t.next&&t.next<=localDate()}
function taskMatchesFilter(t,filter){
 if(filter==='due')return taskIsDue(t);
 if(filter==='upcoming')return !t.complete&&!!t.next&&t.next>localDate();
 if(filter==='open')return !t.complete;
 if(filter==='complete')return !!t.last||!!t.complete;
 return true;
}
function taskStatus(t){
 if(t.complete)return 'Completed';
 if(!t.next)return 'Not scheduled';
 return t.next<localDate()?'Overdue':t.next===localDate()?'Due today':'Scheduled';
}
function maintenanceTaskRow(t){
 const status=taskStatus(t);
 const canComplete=taskFilter!=='complete'&&!t.complete&&t.last!==localDate();
 return `<div class="statRow"><div><b>${esc(t.name)}</b> <span class="status ${taskIsDue(t)?'warn':!t.next?'none':''}">${status}</span><div class="meta">${t.last?'Last completed: '+formatDate(t.last):t.servicePlan?'Initial review · No completion recorded':'No completion recorded'}${!t.complete&&t.next?' · Next due: '+formatDate(t.next):''} · ${t.interval?`Every ${t.interval} days`:'One-off'}${t.notes?' · '+esc(t.notes):''}</div></div><div class="rowActions">${canComplete?`<button class="miniBtn" data-action="finish-task" data-id="${attr(t.id)}">${taskIsDue(t)?'Done':'Complete early'}</button>`:t.last===localDate()?'<span class="smallMuted">Completed today</span>':''}<button class="miniBtn" data-action="edit-task" data-id="${attr(t.id)}">Edit</button><button class="miniBtn" data-action="delete-task" data-id="${attr(t.id)}">×</button></div></div>`;
}

function dueTasks(){return db.tasks.filter(taskIsDue).sort((a,b)=>a.next.localeCompare(b.next))}
function recentActivities(n){return [...db.activities].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,n)}
function dashboard(){let due=dueTasks(),a=recentActivities(5),last=recordedReadings().sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,5);return heading('Aquarium overview',`${esc(db.settings.name)} · ${nfmt(db.settings.volume)} litres · Local-first · optional cloud sync`,button('+ Log water test','new-reading',true)+button('+ Maintenance','new-activity'))+
 `<div class="noteBox topNote">GHL measurements are recorded every 30 minutes while the bridge is running. Manual tests are labelled separately. ${window.ReefSync?.statusLabel()||'Cloud not configured'}.</div>${window.ReefSync?.ghlDashboard()||''}`+
 `<div class="metrics">${cards()}</div><div class="cols"><div><section class="panel"><div class="panelHead"><h2>Measurement trends</h2><button class="miniBtn" data-nav="chemistry">All measurements</button></div>${chartPanel()}</section><section class="panel"><div class="panelHead"><h2>Recent measurements</h2><button class="miniBtn" data-action="new-reading">+ Add</button></div>${last.length?`<div class="tableWrap"><table class="dataTable"><thead><tr><th>Parameter</th><th>Result</th><th>Recorded</th></tr></thead><tbody>${last.map(r=>`<tr><td><b>${esc(TYPES[r.type]?.label||r.type)}</b></td><td>${nfmt(r.value)} ${esc(r.unit??unit(r.type))}</td><td>${readingDate(r)}</td></tr>`).join('')}</tbody></table></div>`:empty('No measurements yet','Start by recording your latest results.')}</section></div>
 <div><section class="panel"><div class="panelHead"><h2>Maintenance due</h2><button class="miniBtn" data-nav="maintenance">View all</button></div>${due.length?due.slice(0,6).map(t=>`<div class="statRow"><div><b>${esc(t.name)}</b><div class="meta">${t.next<localDate()?'Overdue':'Due today'} · ${formatDate(t.next)}</div></div><button class="miniBtn" data-action="finish-task" data-id="${attr(t.id)}">Complete</button></div>`).join(''):empty('Nothing overdue','Your scheduled tasks are up to date.')}</section><section class="panel"><div class="panelHead"><h2>Activity log</h2><button class="miniBtn" data-nav="maintenance">View log</button></div>${a.length?a.map(x=>`<div class="statRow"><div><b>${esc(x.type)}</b><div class="meta">${formatDate(x.date)} · ${esc(x.notes||'No notes')}</div></div>${x.litres?`<b>${nfmt(x.litres)} L</b>`:''}</div>`).join(''):empty('No activity yet','Log maintenance, NSW deliveries or water changes.')}</section><div class="noteBox">Back up regularly. Local edits work offline; cloud sync requires owner sign-in and network access.</div></div></div>`}


const CHART_AXES={
 temperature:{step:.25,dp:1,maxTicks:12},salinity:{step:.5,dp:1},ph:{step:.1,dp:1},
 alkalinity:{step:.5,dp:1},calcium:{step:10,dp:0},magnesium:{step:50,dp:0},
 nitrate:{step:1,dp:0},phosphate:{step:.05,dp:2},ammonia:{step:.25,dp:2},nitrite:{step:.25,dp:2},
 redox:{step:25,dp:0},conductivity:{step:.5,dp:1},flow:{step:100,dp:0},
 reefrun_1_flow:{step:100,dp:0},uv_branch_flow:{step:100,dp:0},reefrun_2_flow:{step:100,dp:0}
};
function chartAxis(type,min,max){
 const cfg=CHART_AXES[type]||{step:1,dp:0};
 const padding=Math.max((max-min)*.08,cfg.step*.4);
 const lower=min>=0?Math.max(0,min-padding):min-padding,upper=max+padding;
 const steps=new Set([cfg.step]);
 for(let exponent=-6;exponent<=15;exponent++)for(const factor of [1,2,2.5,5]){
  const step=factor*10**exponent;
  if(step>=cfg.step&&Math.abs(step/cfg.step-Math.round(step/cfg.step))<1e-6)steps.add(step);
 }
 const limit=cfg.maxTicks||8;
 let step=[...steps].sort((a,b)=>a-b).find(v=>Math.ceil(upper/v-1e-9)-Math.floor(lower/v+1e-9)+1<=limit);
 if(!step)step=Math.max(cfg.step,(upper-lower)/5);
 const loIndex=Math.floor(lower/step+1e-9),hiIndex=Math.ceil(upper/step-1e-9);
 const low=Number((loIndex*step).toPrecision(12)),high=Number((hiIndex*step).toPrecision(12));
 let dp=cfg.dp;
 while(dp<6&&Math.abs(step*10**dp-Math.round(step*10**dp))>1e-6)dp++;
 const ticks=Array.from({length:hiIndex-loIndex+1},(_,i)=>Number(((loIndex+i)*step).toPrecision(12)));
 const label=value=>value.toLocaleString('en-GB',{minimumFractionDigits:dp,maximumFractionDigits:dp});
 return {low,high,step,ticks,label};
}
function chartTimeLabel(timestamp,span){
 const opts=span<=2*86400000?{hour:'2-digit',minute:'2-digit'}:span>300*86400000?{day:'numeric',month:'short',year:'2-digit'}:{day:'numeric',month:'short'};
 return new Intl.DateTimeFormat('en-GB',opts).format(new Date(timestamp));
}


let chartPeriod='all',chartSource='all',chartStart='',chartEnd='',chartMarkers=true;
const WATER_CHANGE_METRICS=new Set(['temperature','salinity','ph','alkalinity','calcium','magnesium','nitrate','phosphate','ammonia','nitrite','redox','conductivity']);
function chartSelection(now=Date.now()){
 let from=-Infinity,to=Infinity,error='';
 if(chartPeriod==='custom'){
  from=Date.parse(chartStart);to=Date.parse(chartEnd);
  if(!Number.isFinite(from)||!Number.isFinite(to)||from>=to)error='Choose a start date/time before the end date/time.';
 }else if(chartPeriod!=='all'){
  to=now;from=now-Number(chartPeriod)*86400000;
 }
 const data=error?[]:recordedReadings().filter(r=>r.type===metric&&r.value!==null&&Number.isFinite(Number(r.value))&&Number.isFinite(Date.parse(r.at))&&Date.parse(r.at)>=from&&Date.parse(r.at)<=to&&(chartSource==='all'||readingSource(r)===(chartSource==='manual'?'Manual':chartSource))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 const first=Number.isFinite(from)?from:data.length?Date.parse(data[0].at):now-86400000;
 const last=Number.isFinite(to)?to:data.length?Date.parse(data.at(-1).at):now;
 return {data,first,last,error};
}
function chartWaterChanges(first,last){
 if(!chartMarkers||!WATER_CHANGE_METRICS.has(metric))return [];
 return db.activities.filter(a=>a.type==='Water change'&&a.date).map(a=>{
  const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(a.date);
  const start=Date.parse(dateOnly?a.date+'T00:00:00':a.date);
  const end=dateOnly?new Date(new Date(start).getFullYear(),new Date(start).getMonth(),new Date(start).getDate()+1).getTime()-1:start;
  return {...a,start,end,dateOnly};
 }).filter(a=>Number.isFinite(a.start)&&a.end>=first&&a.start<=last).sort((a,b)=>a.start-b.start);
}
function changeChartWindow(factor=1,shift=0){
 const {first,last}=chartSelection();
 const width=Math.max(last-first,3600000),middle=(first+last)/2+width*shift;
 const half=Math.max(15*60000,width*factor/2);
 chartStart=localDateTime(new Date(middle-half));chartEnd=localDateTime(new Date(middle+half));chartPeriod='custom';render();
}
function chartControls(options){
 const selectOptions=(pairs,current)=>pairs.map(([value,label])=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`).join('');
 return `<div class="inlineControl" style="margin-bottom:12px;flex-wrap:wrap;gap:8px"><select id="chartMetric" class="select" aria-label="Chart parameter" style="width:auto;min-width:160px">${options}</select><select id="chartPeriod" class="select" aria-label="Chart date range" style="width:auto">${selectOptions([['1','Last 24 hours'],['7','Last 7 days'],['30','Last 30 days'],['all','All available'],['custom','Custom range']],chartPeriod)}</select><select id="chartSource" class="select" aria-label="Reading source" style="width:auto">${selectOptions([['all','All sources'],['manual','Manual'],['Aquarimate','Aquarimate'],['GHL','GHL']],chartSource)}</select>${WATER_CHANGE_METRICS.has(metric)?`<label class="smallMuted"><input id="chartMarkers" type="checkbox" ${chartMarkers?'checked':''}> Water changes</label>`:''}</div>${chartPeriod==='custom'?`<div class="inlineControl" style="margin-bottom:12px;flex-wrap:wrap;gap:8px"><label class="smallMuted">From <input id="chartStart" class="input" type="datetime-local" value="${attr(chartStart)}"></label><label class="smallMuted">To <input id="chartEnd" class="input" type="datetime-local" value="${attr(chartEnd)}"></label></div>`:''}<div class="inlineControl" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">${button('Earlier','chart-earlier')}${button('Zoom in','chart-zoom-in')}${button('Zoom out','chart-zoom-out')}${button('Later','chart-later')}<span class="smallMuted">All available includes loaded GHL history (last 30 days).</span></div>`;
}

function chartPanel(){
 const options=Object.entries(TYPES).map(([k,t])=>`<option value="${k}" ${metric===k?'selected':''}>${esc(t.label)}</option>`).join('');
 const selection=chartSelection(),data=selection.data;
 const range=db.settings.targets?.[metric]||TYPES[metric];
 const hasRange=typeof range?.min==='number'&&typeof range?.max==='number'&&Number.isFinite(range.min)&&Number.isFinite(range.max)&&range.min<=range.max;
 const rangeLabel=hasRange?`${nfmt(range.min)}–${nfmt(range.max)} ${unit(metric)}`.trim():'Not set';
 let svg;
 if(selection.error)svg=empty('Check the date range',selection.error);
 else if(!data.length)svg=empty('No readings to chart','No measurements match this parameter, date range and source. Try All available or All sources.');
 else{
  const W=660,H=260,L=65,R=18,T=16,B=40;
  const vals=data.map(r=>Number(r.value));
  // Include the whole target band as well as every actual reading in the scale.
  const mins=Math.min(...vals,...(hasRange?[range.min]:[])),maxs=Math.max(...vals,...(hasRange?[range.max]:[]));

  const axis=chartAxis(metric,mins,maxs),{low,high}=axis;
  const {first,last}=selection,span=last-first;
  const timeX=t=>L+(W-L-R)*(span?(t-first)/span:.5);
  const x=i=>timeX(Date.parse(data[i].at));
  const y=v=>T+(H-T-B)*(high-v)/(high-low);
  const coords=data.map((r,i)=>`${x(i)},${y(Number(r.value))}`).join(' ');
  const grid=axis.ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#27404d" stroke-dasharray="3 5"/><text class="yTick" x="${L-9}" y="${y(v)+4}" text-anchor="end" fill="#96abba" font-size="11">${axis.label(v)}</text>`).join('');
  const timeTicks=span?[0,1/3,2/3,1].map(f=>first+span*f):[first];
  const timeAxis=timeTicks.map((t,i)=>`<text class="xTick" x="${timeX(t)}" y="${H-12}" text-anchor="${timeTicks.length===1?'middle':i===0?'start':i===timeTicks.length-1?'end':'middle'}" fill="#96abba" font-size="11">${esc(chartTimeLabel(t,span))}</text>`).join('');

  const changes=chartWaterChanges(first,last);
  const waterMarkers=changes.map(a=>{
   const left=timeX(Math.max(first,a.start)),right=timeX(Math.min(last,a.end));
   const center=(left+right)/2;
   const label=`Water change · ${formatDate(a.date)}${Number(a.litres)>0?' · '+nfmt(a.litres)+' L':''}${a.dateOnly?' · time not recorded':''}${a.notes?' · '+a.notes:''}`;
   return `<g class="waterChangeMarker"><title>${esc(label)}</title>${a.dateOnly?`<rect x="${left}" y="${T}" width="${Math.max(1,right-left)}" height="${H-T-B}" fill="#74baff" fill-opacity="0.10"/>`:`<line x1="${left}" x2="${left}" y1="${T}" y2="${H-B}" stroke="#74baff" stroke-dasharray="3 4"/>`}<path d="M ${center-4} ${T+1} L ${center+4} ${T+1} L ${center} ${T+8} Z" fill="#74baff"/></g>`;
  }).join('');
  const changeList=changes.length?`<details style="margin-top:10px"><summary>${changes.length} water change${changes.length===1?'':'s'} in this view</summary>${changes.map(a=>`<div class="statRow"><div><b>${esc(formatDate(a.date))}${Number(a.litres)>0?' · '+nfmt(a.litres)+' L':''}</b><div class="meta">${a.dateOnly?'Time not recorded; the whole day is highlighted.':esc(new Date(a.start).toLocaleTimeString('en-GB'))}${a.notes?' · '+esc(a.notes):''}</div></div><button class="miniBtn" data-action="edit-activity" data-id="${attr(a.id)}">Edit</button></div>`).join('')}</details>`:'';
  const boundaries=hasRange?[...new Set([range.min,range.max])].map(v=>`<line class="targetBoundary" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#8cdda2" stroke-width="1.2" stroke-dasharray="5 4"/>`).join(''):'';
  const band=hasRange?`<g class="targetRange"><title>Target range ${esc(rangeLabel)}</title>${range.max>range.min?`<rect class="targetBand" x="${L}" y="${y(range.max)}" width="${W-L-R}" height="${y(range.min)-y(range.max)}" fill="#70ce91" fill-opacity="0.14"/>`:''}${boundaries}</g>`:'';
  svg=`<div class="chartCanvas"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(TYPES[metric].label)} trend chart with ${data.length} readings; target range ${esc(rangeLabel)}"><desc>Green shading shows the configured target range. Orange points are outside it.</desc>${grid}${band}${waterMarkers}<polyline points="${coords}" stroke="#54d9ce" fill="none" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round"/>${data.map((r,i)=>{const outside=hasRange&&(Number(r.value)<range.min||Number(r.value)>range.max);return `<circle cx="${x(i)}" cy="${y(Number(r.value))}" r="3.6" fill="${outside?'#ffb66e':'#a4fff5'}"><title>${nfmt(r.value)} ${esc(r.unit??unit(metric))} · ${esc(readingDate(r))}${outside?' · Outside target':''}</title></circle>`}).join('')}${timeAxis}</svg></div><div class="chartCaption">${esc(readingDate(data[0]))}${span?' – '+esc(readingDate(data.at(-1))):''}<br>${data.length} recorded measurements · ${hasRange?`<span style="color:#8cdda2">${range.min===range.max?'Dashed green line':'Shaded green band'}: target ${esc(rangeLabel)}</span>`:'Target range not set'} · Orange points: outside target.<br>Manual tests and automatic GHL recordings · GHL history: last 30 days. Change targets in Settings.${changes.length?'<br><span style="color:#74baff">Blue markers: logged water changes. Date-only entries shade the whole day.</span>':''}</div>${changeList}`;
 }
 return chartControls(options)+svg;
}
let historyMetric='all',historySource='all',historyFrom='',historyTo='';
function filterHistory(readings){
 return readings.filter(r=>{
  const timestamp=Date.parse(r.at),day=Number.isFinite(timestamp)?localDate(new Date(timestamp)):'';
  return (historyMetric==='all'||r.type===historyMetric)&&(historySource==='all'||readingSource(r)===historySource)&&(!historyFrom||day>=historyFrom)&&(!historyTo||day<=historyTo);
 }).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}
function historyFilters(){
 const select=(key,label,items,current)=>`<div class="field"><label for="${key}">${label}</label><select class="select" id="${key}">${items.map(([v,t])=>`<option value="${attr(v)}" ${v===current?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`;
 return `<div class="formGrid" style="margin-bottom:16px">${select('historyMetric','Parameter',[['all','All parameters'],...Object.entries(TYPES).map(([k,v])=>[k,v.label])],historyMetric)}${select('historySource','Source',[['all','All sources'],['Manual','Manual'],['Aquarimate','Aquarimate'],['GHL','GHL']],historySource)}<div class="field"><label for="historyFrom">From date</label><input class="input" id="historyFrom" type="date" value="${attr(historyFrom)}" ${historyTo?'max="'+attr(historyTo)+'"':''}></div><div class="field"><label for="historyTo">To date</label><input class="input" id="historyTo" type="date" value="${attr(historyTo)}" ${historyFrom?'min="'+attr(historyFrom)+'"':''}></div></div>${button('Clear filters','clear-history-filters')}<p class="help">Newest first · Filters apply only to this table. GHL history covers the last 30 days.</p>${historyFrom&&historyTo&&historyFrom>historyTo?'<p role="alert">Choose a from date on or before the to date.</p>':''}`;
}
function refreshHistory(){const y=window.scrollY,focused=document.activeElement?.id;render();window.scrollTo(0,y);if(focused)document.getElementById(focused)?.focus({preventScroll:true});}
function chemistry(){const all=recordedReadings(),arr=filterHistory(all);return heading('Measurements','Record measurements, review trends and compare with your own targets.',button('Import readings','import-measurements')+button('Export CSV','export-csv')+button('+ Record test','new-reading',true))+
 `<section class="panel"><div class="panelHead"><h2>Parameter trends</h2><span class="smallMuted">Manual + GHL · last 30 days of GHL history</span></div>${chartPanel()}</section><section class="panel"><div class="panelHead"><h2>Measurement history</h2><span class="smallMuted">${arr.length} of ${all.length} records</span></div>${historyFilters()}${arr.length?`<div class="tableWrap"><table class="dataTable"><thead><tr><th>Date</th><th>Parameter</th><th>Value</th><th>Target</th><th>Notes</th><th class="right">Actions</th></tr></thead><tbody>${arr.map(r=>`<tr><td>${readingDate(r)}</td><td><b>${esc(TYPES[r.type]?.label||r.type)}</b></td><td>${nfmt(r.value)} ${esc(r.unit??unit(r.type))}</td><td>${badge(r.value,r.type)}</td><td>${esc(r.source==='GHL'?'GHL · automatic recording':r.notes||'—')}</td><td class="right">${r.source==='GHL'?'<span class="smallMuted">GHL · read only</span>':`<div class="rowActions"><button class="miniBtn" data-action="edit-reading" data-id="${attr(r.id)}">Edit</button><button class="miniBtn" data-action="delete-reading" data-id="${attr(r.id)}">Delete</button></div>`}</td></tr>`).join('')}</tbody></table></div>`:empty(all.length?'No matching measurements':'Your log is empty',all.length?'Change or clear the history filters to see more readings.':'Record a measurement or connect GHL to start tracking water parameters and flow.')}</section>`}
function maintenance(){const tasks=[...db.tasks].filter(t=>taskMatchesFilter(t,taskFilter));const activities=[...db.activities].sort((a,b)=>String(b.date).localeCompare(String(a.date)));return heading('Maintenance','Recurring tasks, water changes and natural seawater delivery records.',button('+ Log activity','new-activity')+button('+ Add task','new-task',true))+
 `${db.tasks.some(t=>t.servicePlan&&!t.last)?'<div class="noteBox topNote">Service schedule added. Last service dates are unknown, so new tasks are due for an initial review today. Edit due dates to match your records; mark Done only after completing the service. Stagger the two return-pump services.</div>':''}<div class="cols"><section class="panel"><div class="panelHead"><h2>Maintenance schedule</h2><div class="inlineControl"><select id="taskFilter" class="select" style="width:auto"><option value="due" ${taskFilter==='due'?'selected':''}>Due now</option><option value="upcoming" ${taskFilter==='upcoming'?'selected':''}>Upcoming</option><option value="open" ${taskFilter==='open'?'selected':''}>All active</option><option value="all" ${taskFilter==='all'?'selected':''}>All tasks</option><option value="complete" ${taskFilter==='complete'?'selected':''}>Completed services</option></select></div></div>${tasks.length?tasks.sort((a,b)=>String(a.next).localeCompare(String(b.next))).map(maintenanceTaskRow).join(''):empty(taskFilter==='due'?'Nothing due now':'No tasks in this view',taskFilter==='due'?'Completed recurring tasks move to Upcoming. Choose Completed services to review what you have done.':'Choose another filter to see the rest of your schedule.')}</section>
 <section class="panel"><div class="panelHead"><h2>Water-change snapshot</h2></div>${activitySnapshot(activities)}<div class="noteBox spaced">Record incoming NSW deliveries separately from water changes. Only a water-change entry counts as water exchanged; a delivery alone does not change aquarium chemistry.</div></section></div><section class="panel"><div class="panelHead"><h2>Maintenance & delivery history</h2><span class="smallMuted">${activities.length} records</span></div>${activities.length?`<div class="tableWrap"><table class="dataTable"><thead><tr><th>Date</th><th>Activity</th><th>Volume</th><th>Notes</th><th class="right">Actions</th></tr></thead><tbody>${activities.map(r=>`<tr><td>${formatDate(r.date)}${r.date?.includes('T')?'<br>'+esc(r.date.slice(11,16)):''}</td><td><b>${esc(r.type)}</b></td><td>${r.litres?nfmt(r.litres)+' L':'—'}</td><td>${esc(r.source==='GHL'?'GHL · automatic recording':r.notes||'—')}</td><td class="right"><div class="rowActions"><button class="miniBtn" data-action="edit-activity" data-id="${attr(r.id)}">Edit</button><button class="miniBtn" data-action="delete-activity" data-id="${attr(r.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`:empty('No logged activity','Record your next water change or equipment maintenance.')}</section>`}
function activitySnapshot(a){const changes=a.filter(x=>x.type==='Water change');const deliveries=a.filter(x=>x.type==='Natural seawater delivery');const sum=xs=>xs.reduce((s,x)=>s+Number(x.litres||0),0);return `<div class="statRow"><div><b>Water changed (all logged)</b><div class="meta">${changes.length} recorded events</div></div><b>${nfmt(sum(changes))} L</b></div><div class="statRow"><div><b>NSW received (all logged)</b><div class="meta">${deliveries.length} recorded deliveries</div></div><b>${nfmt(sum(deliveries))} L</b></div><div class="statRow"><div><b>Last water change</b></div><b>${changes.length?formatDate(changes[0].date):'Not recorded'}</b></div>`}

function equipmentServiceTasks(e){
 if(Array.isArray(e.serviceTaskIds))return db.tasks.filter(t=>e.serviceTaskIds.includes(t.id));
 const name=e.name.toLowerCase();let keys=[];
 if(/flow.*sensor|sensor.*flow/.test(name))keys=['flow-check','flow-clean'];
 else if(/conductivity|salinity/.test(name))keys=['probes-clean','probe-conductivity'];
 else if(/redox|\borp\b/.test(name))keys=['probes-clean','probe-redox'];
 else if(/\bph\b/.test(name))keys=['probes-clean','probe-ph'];
 else if(/reef\s*mat/.test(name))keys=['reefmat-check','reefmat-clean'];
 else if(/skimmer/.test(name))keys=['skimmer-cup','skimmer-pump'];
 else if(/reef\s*run/.test(name)){
  keys=/reef\s*run\s*1\b/.test(name)?['return1-check','return1-clean']:/reef\s*run\s*2\b/.test(name)?['return2-check','return2-clean']:['return1-check','return1-clean','return2-check','return2-clean'];
 }
 else if(/gyre/.test(name))keys=['gyre-check','gyre-clean'];
 else if(/\buv\b|ultraviolet/.test(name))keys=['uv-flow','uv-sleeve','uv-lamp'];
 else if(/orphek|icon/.test(name))keys=['lights-clean'];
 else if(/profilux/.test(name))keys=['controller-check','controller-backup','probes-clean','probe-ph','probe-conductivity','probe-redox','flow-check','flow-clean'];
 const labels=new Set(SERVICE_SCHEDULE.filter(r=>keys.includes(r[0])).map(r=>r[1].toLowerCase()));
 return db.tasks.filter(t=>keys.some(k=>t.id==='reef-service-v1-'+k)||labels.has(t.name.trim().toLowerCase()));
}
function equipmentServicePanel(e){
 const tasks=equipmentServiceTasks(e);
 const due=tasks.filter(t=>!t.complete&&t.next).sort((a,b)=>a.next.localeCompare(b.next));
 const next=due[0];
 const manualNext=e.service&&e.last?afterDays(e.last,e.service):'';
 if(!tasks.length)return `<div class="tileDetail">Service interval: ${e.service?`Every ${nfmt(e.service)} days`:'Not set'}<br>Last serviced: ${e.last?formatDate(e.last):'Not recorded'}<br>Next service: ${manualNext?formatDate(manualNext):e.service?'Set the last service date to calculate':'Not scheduled'}</div>`;
 return `<div class="tileDetail"><b>Next: ${next?formatDate(next.next):'No open tasks'}</b>${next?'<br>'+esc(next.name):''}</div><details class="spaced"><summary>${tasks.length} linked service tasks</summary>${tasks.map(t=>`<div class="statRow"><div><b>${esc(t.name)}</b><div class="meta">${t.interval?`Every ${nfmt(t.interval)} days`:'One-off'}<br>Last: ${t.last?formatDate(t.last):'Not recorded'}<br>${taskStatus(t)}${!t.complete&&t.next?' · Next: '+formatDate(t.next):''}${t.servicePlan&&!t.last?' · Initial review':''}</div></div>${!t.complete&&t.last!==localDate()?`<button class="miniBtn" data-action="finish-task" data-id="${attr(t.id)}">Done</button>`:''}</div>`).join('')}</details>${e.service?`<p class="meta">Additional equipment interval: every ${nfmt(e.service)} days · Last: ${e.last?formatDate(e.last):'Not recorded'} · Next: ${manualNext?formatDate(manualNext):'Last service date needed'}</p>`:''}`;
}
function equipment(){return heading('Equipment register','Inventory and linked service schedules. Completing a service updates its next due date.',button('+ Add equipment','new-equipment',true))+
 `<div class="tileGrid">${db.equipment.length?db.equipment.map(e=>{const tasks=equipmentServiceTasks(e);return `<article class="infoTile"><div class="tileHead"><div><div class="tileTitle">${esc(e.name)}</div><div class="tileDetail">${esc(e.category||'Other')} · Quantity ${nfmt(e.quantity||1)}</div></div><span class="tag">${tasks.length?'Service scheduled':'Inventory'}</span></div><div class="tileDetail">Installed: ${formatDate(e.installed)}${e.notes?'<br>'+esc(e.notes):''}</div>${equipmentServicePanel(e)}<div class="tileFoot"><button class="miniBtn" data-nav="maintenance">Manage service tasks</button><div class="rowActions"><button class="miniBtn" data-action="edit-equipment" data-id="${attr(e.id)}">Edit</button><button class="miniBtn" data-action="delete-equipment" data-id="${attr(e.id)}">Delete</button></div></div></article>`}).join(''):empty('No equipment','Add your pumps, lights and filtration hardware.')}</div>`}
function livestock(){const list=db.livestock.filter(x=>livestockFilter==='all'||x.status===livestockFilter),count=db.livestock.filter(x=>x.status==='current').reduce((sum,x)=>sum+Number(x.quantity||0),0);return heading('Livestock register','Track your current stock, losses and potential additions.',button('+ Add livestock','new-livestock',true))+
 `<div class="split" style="margin-bottom:15px"><div class="kpiLine"><b>${nfmt(count)}</b><span class="subtle">${db.livestock.some(x=>x.status==='current'&&x.quantity==null)?'recorded animals (some quantities unknown)':'recorded animals'}</span></div></div><div class="pillTabBar">${[['all','All'],['current','Current'],['planned','Planned'],['lost','Lost']].map(([k,v])=>`<button class="pillTab ${livestockFilter===k?'active':''}" data-action="stock-filter" data-id="${k}">${v}</button>`).join('')}</div><div class="tileGrid">${list.length?list.map(s=>`<article class="infoTile"><div class="tileHead"><div><div class="tileTitle">${esc(s.name)}</div><div class="tileDetail">${esc(s.kind)} · Quantity ${s.quantity==null?'Unknown':nfmt(s.quantity)}</div></div><span class="tag ${s.status==='planned'?'planned':s.status==='lost'?'lost':''}">${esc(s.status)}</span></div><div class="tileDetail">${s.added?'Added / recorded: '+formatDate(s.added):'Date not recorded'}${s.notes?'<br>'+esc(s.notes):''}</div><div class="tileFoot"><span class="smallMuted">${esc(s.kind)}</span><div class="rowActions"><button class="miniBtn" data-action="edit-livestock" data-id="${attr(s.id)}">Edit</button><button class="miniBtn" data-action="delete-livestock" data-id="${attr(s.id)}">Delete</button></div></div></article>`).join(''):empty('No matching stock','Choose another filter or add a new entry.')}</div>`}
function settings(){return heading('Settings & backups','Personal configuration and straightforward data portability.',button('Download backup','export-json',true))+
 `${window.ReefSync?.settingsPanel()||''}<div class="settingsCards"><section class="panel"><div class="panelHead"><h2>Aquarium profile</h2></div><form id="settingsForm" class="settingGroup"><div class="field"><label for="tankName">Aquarium name</label><input id="tankName" name="name" class="input" required maxlength="70" value="${attr(db.settings.name)}"></div><div class="field"><label for="tankVolume">System volume (litres)</label><input id="tankVolume" name="volume" class="input" type="number" min="1" max="100000" step="1" required value="${attr(db.settings.volume)}"></div><div>${button('Save aquarium settings','save-settings',true)}</div></form></section><section class="panel"><div class="panelHead"><h2>Local data & privacy</h2></div><p class="subtle">Your local copy remains on this device. Enable Supabase above to synchronise with other devices using your private account.</p><div class="settingGroup"><button type="button" class="btn" data-action="export-json">Download complete JSON backup</button><button type="button" class="btn" data-action="export-csv">Export measurements as CSV</button><button type="button" class="btn" data-action="import-json">Restore JSON backup</button><button type="button" class="btn danger" data-action="reset-data">Reset all local records</button></div><p class="help">Cloud sync merges separately added records and handles deletions. Concurrent edits to the same record use last-modified time; keep occasional JSON backups.</p></section></div>
 <section class="panel"><div class="panelHead"><h2>Target chemistry ranges</h2><span class="smallMuted">Reference values are editable; use your chosen husbandry targets</span></div><form id="targetsForm"><div class="tableWrap"><table class="dataTable"><thead><tr><th>Parameter</th><th>Minimum</th><th>Maximum</th><th>Unit</th></tr></thead><tbody>${Object.entries(TYPES).map(([k,t])=>`<tr><td><b>${esc(t.label)}</b></td><td><input class="input" type="number" step="any" name="${k}-min" value="${attr(db.settings.targets?.[k]?.min??t.min)}" required style="min-width:85px"></td><td><input class="input" type="number" step="any" name="${k}-max" value="${attr(db.settings.targets?.[k]?.max??t.max)}" required style="min-width:85px"></td><td>${esc(t.unit||'—')}</td></tr>`).join('')}</tbody></table></div><div class="spaced">${button('Save target ranges','save-targets',true)}</div></form></section>
 <section class="panel"><div class="panelHead"><h2>ProfiLux integration</h2><span class="status none">Read-only feed</span></div><p class="subtle">To retrieve live measurements, run the optional Windows GHL bridge on the same local network as the ProfiLux. Until the bridge sends actual measurements, the dashboard correctly shows no readings. No dosing, switching, maintenance or control commands are sent by Reef Command.</p></section><section class="panel"><div class="panelHead"><h2>Installing on Android or Windows</h2></div><p class="subtle">For app-style installation, host these files on an HTTPS site such as GitHub Pages. In Chrome on Android, choose “Add to Home screen” or “Install app”; in Microsoft Edge on Windows, choose Apps → Install this site as an app. Opening the standalone HTML file on a computer also works, but it is not an installed PWA and file-based browser storage may be less reliable.</p></section>`}
function render(){const navHtml=NAV.map(([k,t,i])=>`<button data-nav="${k}" class="${page===k?'active':''}" ${page===k?'aria-current="page"':''}><span class="navIcon" aria-hidden="true">${i}</span>${t}</button>`).join('');document.getElementById('desktopNav').innerHTML=navHtml;document.getElementById('mobileNav').innerHTML=navHtml;document.getElementById('todayLabel').textContent=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(new Date());document.getElementById('content').innerHTML=({dashboard,chemistry,maintenance,equipment,livestock,settings}[page]||dashboard)();document.title=({dashboard:'Overview',chemistry:'Measurements',maintenance:'Maintenance',equipment:'Equipment',livestock:'Livestock',settings:'Settings'}[page]||'Reef Command')+' · Reef Command';}
const field=(key,label,value='',kind='text',extra='')=>`<div class="field"><label for="f-${key}">${esc(label)}</label><input class="input" id="f-${key}" name="${esc(key)}" type="${kind}" value="${attr(value)}" ${extra}></div>`;
const options=(key,label,opts,value)=>`<div class="field"><label for="f-${key}">${esc(label)}</label><select class="select" id="f-${key}" name="${esc(key)}">${opts.map(([k,v])=>`<option value="${attr(k)}" ${value===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`;
const notes=(value)=>`<div class="field span2"><label for="f-notes">Notes</label><textarea class="textarea" id="f-notes" name="notes" maxlength="1500" rows="3">${esc(value||'')}</textarea></div>`;
const MODES={
 reading:{collection:'readings',title:'Water test',page:'chemistry'},
 task:{collection:'tasks',title:'Maintenance task',page:'maintenance'},
 activity:{collection:'activities',title:'Activity',page:'maintenance'},
 equipment:{collection:'equipment',title:'Equipment item',page:'equipment'},
 livestock:{collection:'livestock',title:'Livestock',page:'livestock'}
};
function showModal(mode,recordId){const cfg=MODES[mode],entry=recordId?db[cfg.collection].find(x=>x.id===recordId):null;if(recordId&&!entry)return;let body='';
 if(mode==='reading')body=options('type','Parameter',Object.entries(TYPES).map(([k,v])=>[k,v.label]),entry?.type||metric)+field('value','Measured value',entry?.value??'','number','step="any" required')+field('at','Date and time',entry?.at||localDateTime(),'datetime-local','required')+notes(entry?.notes);
 if(mode==='task')body=field('name','Task',entry?.name||'','text','required maxlength="120"')+field('interval','Repeat every (days; 0 for one-off)',entry?.interval??7,'number','required min="0" max="3650" step="1"')+field('next','Next due date',entry?.next||localDate(),'date','required')+options('complete','Status',[['false','Open'],['true','Completed']],entry?.complete?'true':'false')+notes(entry?.notes);
 if(mode==='activity')body=options('type','Activity',[['Water change','Water change'],['Natural seawater delivery','Natural seawater delivery'],['Equipment service','Equipment service'],['Coral maintenance','Coral maintenance'],['Algae removal','Algae removal'],['Other','Other']],entry?.type||'Water change')+field('date','Date',entry?.date?.slice(0,10)||localDate(),'date','required')+field('time','Time (optional; local time)',entry?.date?.includes('T')?entry.date.slice(11,16):'','time')+field('litres','Volume (L; if applicable)',entry?.litres||'','number','min="0" step="0.1"')+notes(entry?.notes);
 if(mode==='equipment')body=field('name','Equipment name',entry?.name||'','text','required maxlength="120"')+options('category','Category',[['Monitoring','Monitoring'],['Filtration','Filtration'],['Return pump','Return pump'],['Circulation','Circulation'],['Lighting','Lighting'],['Sterilisation','Sterilisation'],['Heating','Heating'],['Dosing','Dosing'],['Other','Other']],entry?.category||'Other')+field('quantity','Quantity',entry?.quantity??1,'number','required min="1" max="1000" step="1"')+field('installed','Installed date',entry?.installed||'','date')+field('service','Service interval (days; 0 for none)',entry?.service??0,'number','min="0" max="3650" step="1"')+field('last','Last serviced',entry?.last||'','date')+notes(entry?.notes);
 if(mode==='livestock')body=field('name','Species / description',entry?.name||'','text','required maxlength="140"')+options('kind','Category',[['Fish','Fish'],['Coral','Coral'],['Invertebrate','Invertebrate'],['Other','Other']],entry?.kind||'Fish')+field('quantity','Quantity',entry?.quantity??'','number','min="1" max="10000" step="1"')+options('status','Status',[['current','Current'],['planned','Planned'],['lost','Lost / deceased']],entry?.status||'current')+field('added','Date introduced / recorded',entry?.added||'','date')+notes(entry?.notes);
 const host=document.getElementById('modalHost');modalOrigin=document.activeElement;host.innerHTML=`<div class="modalBackdrop" data-backdrop="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modalHead"><h2 id="modalTitle">${entry?'Edit':'Add'} ${esc(cfg.title.toLowerCase())}</h2><button type="button" class="xBtn" data-action="close-modal" aria-label="Close">×</button></div><form id="editForm" data-mode="${mode}" data-id="${attr(recordId||'')}"><div class="modalBody"><div class="formGrid">${body}</div><div class="modalFooter"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save record</button></div></div></form></section></div>`;document.body.style.overflow='hidden';host.querySelector('input,select,textarea')?.focus();}
function closeModal(){document.getElementById('modalHost').innerHTML='';document.body.style.overflow='';modalOrigin?.focus?.();modalOrigin=null;}
function value(v){return typeof v==='string'?v.trim():v}
function submitEdit(form){const mode=form.dataset.mode,cfg=MODES[mode],obj=Object.fromEntries(new FormData(form).entries()),recordId=form.dataset.id;const old=recordId?db[cfg.collection].find(x=>x.id===recordId):null;const record={...(old||{}),id:old?.id||id()};
 if(mode==='reading'){
  if(!TYPES[obj.type])return alert('Unknown parameter.');const v=Number(obj.value);if(obj.value===''||!Number.isFinite(v)||v<0)return alert('Please enter a valid non-negative reading.');Object.assign(record,{type:obj.type,value:v,at:obj.at,notes:value(obj.notes)});metric=obj.type;
 } else if(mode==='task'){
  if(!value(obj.name))return alert('Please enter a task.');Object.assign(record,{name:value(obj.name),interval:Number(obj.interval),next:obj.next,last:old?.last||'',complete:obj.complete==='true',notes:value(obj.notes)});
 } else if(mode==='activity'){
  const v=obj.litres===''?null:Number(obj.litres);if(v!==null&&(!Number.isFinite(v)||v<0))return alert('Please enter a valid volume.');const date=obj.time?obj.date+'T'+obj.time:obj.date;if(!/^\d{4}-\d{2}-\d{2}$/.test(obj.date)||!Number.isFinite(Date.parse(date))||(obj.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(obj.time)))return alert('Please enter a valid date and time.');Object.assign(record,{type:obj.type,date,litres:v,notes:value(obj.notes)});
 } else if(mode==='equipment'){
  if(!value(obj.name))return alert('Please enter an equipment name.');Object.assign(record,{name:value(obj.name),category:obj.category,quantity:Number(obj.quantity),installed:obj.installed,service:Number(obj.service||0),last:obj.last,notes:value(obj.notes)});
 } else if(mode==='livestock'){
  if(!value(obj.name))return alert('Please enter a species or name.');Object.assign(record,{name:value(obj.name),kind:obj.kind,quantity:obj.quantity===''?null:Number(obj.quantity),status:obj.status,added:obj.added,notes:value(obj.notes)});
 }
 if(old){db[cfg.collection]=db[cfg.collection].map(x=>x.id===old.id?record:x)}else db[cfg.collection].push(record);
 if(save()){closeModal();page=cfg.page;render();toast('Record saved');}
}
function finishTask(taskId){const t=db.tasks.find(x=>x.id===taskId);if(!t)return;const when=localDate();if(t.last===when){toast('Already completed today'+(t.next?' · Next due '+formatDate(t.next):''));return;}db.activities.push({id:id(),type:'Equipment service',date:when,litres:null,notes:`Completed task: ${t.name}`});t.last=when;if(t.interval>0){t.next=afterDays(when,t.interval);t.complete=false;}else{t.next='';t.complete=true;}if(save()){render();toast('Maintenance logged')};}
function download(filename,text,mime){const b=new Blob([text],{type:mime}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportBackup(){download(`reef-command-backup-${localDate()}.json`,JSON.stringify(db,null,2),'application/json');toast('Backup downloaded')}
function csvValue(x){const v=String(x??'');return /[",\n\r]/.test(v)?'"'+v.replaceAll('"','""')+'"':v}
function exportCsv(){const fields=['Date','Parameter','Value','Unit','Notes'],rows=recordedReadings().map(r=>[r.at,TYPES[r.type]?.label||r.type,r.value,r.unit??unit(r.type),r.source==='GHL'?'GHL · automatic recording':r.notes]);download(`reef-command-measurements-${localDate()}.csv`,[fields,...rows].map(x=>x.map(csvValue).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('CSV downloaded')}

function prepareReadingImport(payload,existing=db.readings){
 if(payload?.format!=='reef-command-measurement-import-v1'||!Array.isArray(payload.readings))throw Error('Choose a prepared readings import JSON file, not an Excel file or full backup.');
 if(payload.readings.length>10000)throw Error('Import is limited to 10,000 readings at a time.');
 const units={ammonia:'ppm',nitrite:'ppm',nitrate:'ppm',phosphate:'ppm',alkalinity:'dKH',salinity:'PSU',ph:'',redox:'mV',temperature:'°C',calcium:'ppm',magnesium:'ppm'};
 const key=r=>JSON.stringify([r.type,r.at,Number(r.value),r.unit??unit(r.type)]);
 const seen=new Set(existing.map(key));
 const additions=[];let skipped=0;
 payload.readings.forEach((r,index)=>{
  const fail=message=>{throw Error('Reading '+(index+1)+': '+message)};
  if(!r||!Object.hasOwn(units,r.type))fail('unsupported parameter');
  if(typeof r.value!=='number'||!Number.isFinite(r.value))fail('value must be a finite number');
  if(r.unit!==units[r.type])fail('unexpected unit for '+r.type);
  if(r.source!=='Aquarimate')fail('expected Aquarimate source');
  if(typeof r.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.at))fail('missing or invalid original date/time');
  const date=new Date(r.at);
  if(!Number.isFinite(+date)||localDateTime(date)!==r.at)fail('invalid calendar date/time');
  const clean={type:r.type,value:r.value,unit:r.unit,at:r.at,source:'Aquarimate',notes:String(r.notes||'Imported from Aquarimate').slice(0,2000)};
  const signature=key(clean);
  if(seen.has(signature)){skipped++;return;}
  seen.add(signature);
  clean.id='aquarimate-'+encodeURIComponent(signature);
  additions.push(clean);
 });
 return {additions,skipped};
}
function mergeImportedReadings(payload){
 const {additions,skipped}=prepareReadingImport(payload);
 if(!additions.length){alert('No new readings to add. '+skipped+' duplicate readings skipped.');return;}
 const sorted=additions.map(r=>r.at).sort();
 if(!confirm('Add '+additions.length+' Aquarimate readings ('+sorted[0].slice(0,10)+' to '+sorted.at(-1).slice(0,10)+')?\n'+skipped+' duplicates will be skipped. Existing measurements, equipment and settings will be kept.'))return;
 const previous=db;
 db={...db,readings:[...db.readings,...additions]};
 if(save()){page='chemistry';render();toast(additions.length+' Aquarimate readings added');}
 else db=previous;
}

function importBackup(file,mode='backup'){if(!file)return;if(file.size>5*1024*1024)return alert('File is too large. Maximum backup size is 5 MB.');const reader=new FileReader();reader.onload=()=>{let imported;try{imported=JSON.parse(String(reader.result));if(mode==='measurements'||imported?.format==='reef-command-measurement-import-v1'){mergeImportedReadings(imported);return;}if(!valid(imported))throw Error('This is not a compatible Reef Command v1 backup.');for(const c of ['readings','tasks','equipment','livestock','activities'])if(imported[c].length>100000)throw Error('Backup contains too many records.');}catch(err){return alert('Could not import: '+err.message)}if(!confirm('Restore this backup? This REPLACES all records currently saved on this device. Download a backup first if you wish to retain them.'))return;const previous=db;db=imported;if(save()){page='dashboard';render();toast('Backup restored')}else db=previous;};reader.onerror=()=>alert('Could not read selected file.');reader.readAsText(file)}
function toast(message){const host=document.getElementById('toastHost');host.innerHTML=`<div class="toast" role="status">${esc(message)}</div>`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>host.innerHTML='',2600)}
function handleAction(action,rid){if(action==='clear-history-filters'){historyMetric='all';historySource='all';historyFrom='';historyTo='';refreshHistory();return;}if(action==='chart-zoom-in'){changeChartWindow(.5);return}if(action==='chart-zoom-out'){changeChartWindow(2);return}if(action==='chart-earlier'){changeChartWindow(1,-.5);return}if(action==='chart-later'){changeChartWindow(1,.5);return}if(action==='close-modal'){closeModal();return}if(action==='new-reading'){showModal('reading');return}if(action==='new-task'){showModal('task');return}if(action==='new-activity'){showModal('activity');return}if(action==='new-equipment'){showModal('equipment');return}if(action==='new-livestock'){showModal('livestock');return}
 if(action.startsWith('edit-')){showModal(action.slice(5),rid);return}
 if(action.startsWith('delete-')){const kind=action.slice(7),cfg=MODES[kind];if(!cfg)return;if(!confirm('Permanently delete this record?'))return;db[cfg.collection]=db[cfg.collection].filter(x=>x.id!==rid);if(save()){render();toast('Record deleted')}return}
 if(action==='finish-task'){finishTask(rid);return}
 if(action==='stock-filter'){livestockFilter=rid;render();return}
 if(action==='export-json'){exportBackup();return}
 if(action==='export-csv'){exportCsv();return}
 if(action==='import-json'||action==='import-measurements'){const input=document.getElementById('importFile');input.dataset.mode=action==='import-measurements'?'measurements':'backup';input.click();return}
 if(action==='save-settings'){const form=document.getElementById('settingsForm');if(!form.reportValidity())return;const f=new FormData(form);db.settings.name=String(f.get('name')).trim()||'My Aquarium';db.settings.volume=Number(f.get('volume'));if(save()){render();toast('Settings saved')}return}
 if(action==='save-targets'){const form=document.getElementById('targetsForm');if(!form.reportValidity())return;const f=new FormData(form);const targets={};for(const key of Object.keys(TYPES)){const min=Number(f.get(key+'-min')),max=Number(f.get(key+'-max'));if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)return alert(`Please check target range: ${TYPES[key].label}`);targets[key]={min,max};}db.settings.targets=targets;if(save()){render();toast('Target ranges saved')}return}
 if(action==='reset-data'){if(!confirm('Delete ALL Reef Command records? If cloud sync is enabled, these deletions will also synchronise to your other devices. Export a backup first.'))return;if(!confirm('Final confirmation: permanently erase all current records?'))return;db=baseline();if(save()){page='dashboard';render();toast('Local records reset')}return}
}
document.addEventListener('click',e=>{const nav=e.target.closest('[data-nav]');if(nav){page=nav.dataset.nav;render();window.scrollTo(0,0);return}const el=e.target.closest('[data-action]');if(el){handleAction(el.dataset.action,el.dataset.id||'');return}if(e.target.matches('.modalBackdrop'))closeModal()});
document.addEventListener('submit',e=>{if(e.target.id==='editForm'){e.preventDefault();submitEdit(e.target)}else if(e.target.id==='settingsForm'||e.target.id==='targetsForm')e.preventDefault()});
document.addEventListener('change',e=>{if(['historyMetric','historySource','historyFrom','historyTo'].includes(e.target.id)){if(e.target.id==='historyMetric')historyMetric=e.target.value;else if(e.target.id==='historySource')historySource=e.target.value;else if(e.target.id==='historyFrom')historyFrom=e.target.value;else historyTo=e.target.value;refreshHistory();return;}if(e.target.id==='chartPeriod'){chartPeriod=e.target.value;if(chartPeriod==='custom'&&(!chartStart||!chartEnd)){chartStart=localDateTime(new Date(Date.now()-7*86400000));chartEnd=localDateTime();}render()}else if(e.target.id==='chartSource'){chartSource=e.target.value;render()}else if(e.target.id==='chartStart'||e.target.id==='chartEnd'){if(e.target.id==='chartStart')chartStart=e.target.value;else chartEnd=e.target.value;render()}else if(e.target.id==='chartMarkers'){chartMarkers=e.target.checked;render()}else if(e.target.id==='chartMetric'){metric=e.target.value;render()}else if(e.target.id==='taskFilter'){taskFilter=e.target.value;render()}else if(e.target.id==='importFile'){importBackup(e.target.files?.[0],e.target.dataset.mode||'backup');e.target.value=''}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('modalHost').innerHTML)closeModal()});
document.getElementById('quickBackup').addEventListener('click',exportBackup);
if(ensureServiceSchedule(db))save();
render();
if(window.__storageError)toast('Local storage may be blocked. Check browser settings.');
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('./sw.js').catch(()=>{});




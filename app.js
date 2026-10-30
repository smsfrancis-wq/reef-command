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
let db=load(),page='dashboard',metric='temperature',livestockFilter='all',taskFilter='open',modalOrigin=null;
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
function dueTasks(){return db.tasks.filter(t=>!t.complete && t.next && t.next<=localDate()).sort((a,b)=>a.next.localeCompare(b.next))}
function recentActivities(n){return [...db.activities].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,n)}
function dashboard(){let due=dueTasks(),a=recentActivities(5),last=recordedReadings().sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,5);return heading('Aquarium overview',`${esc(db.settings.name)} · ${nfmt(db.settings.volume)} litres · Local-first · optional cloud sync`,button('+ Log water test','new-reading',true)+button('+ Maintenance','new-activity'))+
 `<div class="noteBox topNote">GHL measurements are recorded every 30 minutes while the bridge is running. Manual tests are labelled separately. ${window.ReefSync?.statusLabel()||'Cloud not configured'}.</div>${window.ReefSync?.ghlDashboard()||''}`+
 `<div class="metrics">${cards()}</div><div class="cols"><div><section class="panel"><div class="panelHead"><h2>Measurement trends</h2><button class="miniBtn" data-nav="chemistry">All measurements</button></div>${chartPanel()}</section><section class="panel"><div class="panelHead"><h2>Recent measurements</h2><button class="miniBtn" data-action="new-reading">+ Add</button></div>${last.length?`<div class="tableWrap"><table class="dataTable"><thead><tr><th>Parameter</th><th>Result</th><th>Recorded</th></tr></thead><tbody>${last.map(r=>`<tr><td><b>${esc(TYPES[r.type]?.label||r.type)}</b></td><td>${nfmt(r.value)} ${esc(r.unit??unit(r.type))}</td><td>${readingDate(r)}</td></tr>`).join('')}</tbody></table></div>`:empty('No measurements yet','Start by recording your latest results.')}</section></div>
 <div><section class="panel"><div class="panelHead"><h2>Maintenance due</h2><button class="miniBtn" data-nav="maintenance">View all</button></div>${due.length?due.slice(0,6).map(t=>`<div class="statRow"><div><b>${esc(t.name)}</b><div class="meta">${t.next<localDate()?'Overdue':'Due today'} · ${formatDate(t.next)}</div></div><button class="miniBtn" data-action="finish-task" data-id="${attr(t.id)}">Complete</button></div>`).join(''):empty('Nothing overdue','Your scheduled tasks are up to date.')}</section><section class="panel"><div class="panelHead"><h2>Activity log</h2><button class="miniBtn" data-nav="maintenance">View log</button></div>${a.length?a.map(x=>`<div class="statRow"><div><b>${esc(x.type)}</b><div class="meta">${formatDate(x.date)} · ${esc(x.notes||'No notes')}</div></div>${x.litres?`<b>${nfmt(x.litres)} L</b>`:''}</div>`).join(''):empty('No activity yet','Log maintenance, NSW deliveries or water changes.')}</section><div class="noteBox">Back up regularly. Local edits work offline; cloud sync requires owner sign-in and network access.</div></div></div>`}
function chartPanel(){const options=Object.entries(TYPES).map(([k,t])=>`<option value="${k}" ${metric===k?'selected':''}>${esc(t.label)}</option>`).join('');const data=recordedReadings().filter(r=>r.type===metric&&Number.isFinite(Number(r.value))).sort((a,b)=>String(a.at).localeCompare(String(b.at)));let svg;if(!data.length){svg=empty('No readings to chart',`Log ${TYPES[metric].label.toLowerCase()} to create a trend.`)}else{const W=660,H=230,L=49,R=14,T=16,B=35,vals=data.map(r=>Number(r.value)),mins=Math.min(...vals),maxs=Math.max(...vals),spread=Math.max((maxs-mins),Math.max(Math.abs(maxs),1)*.07,.05),low=mins-spread*.4,high=maxs+spread*.4;const x=i=>L+(W-L-R)*(data.length===1?.5:i/(data.length-1));const y=v=>T+(H-T-B)*(high-v)/(high-low);const coords=data.map((r,i)=>`${x(i)},${y(Number(r.value))}`).join(' '),grid=[0,.25,.5,.75,1].map(p=>{const vy=low+(high-low)*(1-p),yy=T+p*(H-T-B);return `<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#27404d" stroke-dasharray="3 5"/><text x="${L-9}" y="${yy+4}" text-anchor="end" fill="#96abba" font-size="11">${nfmt(vy)}</text>`}).join('');svg=`<div class="chartCanvas"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(TYPES[metric].label)} trend chart with ${data.length} readings">${grid}<polyline points="${coords}" stroke="#54d9ce" fill="none" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round"/>${data.map((r,i)=>`<circle cx="${x(i)}" cy="${y(Number(r.value))}" r="3.6" fill="#a4fff5"/>`).join('')}<text x="${L}" y="${H-4}" fill="#96abba" font-size="11">${formatShort(data[0].at)}</text><text x="${W-R}" y="${H-4}" text-anchor="end" fill="#96abba" font-size="11">${formatShort(data[data.length-1].at)}</text></svg></div><div class="chartCaption">${data.length} recorded measurements · Target range: ${target(metric)} · Manual tests and automatic GHL recordings · GHL history: last 30 days.</div>`}
 return `<div class="inlineControl" style="margin-bottom:16px"><select id="chartMetric" class="select" aria-label="Chart parameter" style="width:auto;min-width:180px">${options}</select><span class="smallMuted">Manual + GHL recordings</span></div>${svg}`}
function chemistry(){let arr=recordedReadings().sort((a,b)=>String(b.at).localeCompare(String(a.at)));return heading('Measurements','Record measurements, review trends and compare with your own targets.',button('Import readings','import-measurements')+button('Export CSV','export-csv')+button('+ Record test','new-reading',true))+
 `<section class="panel"><div class="panelHead"><h2>Parameter trends</h2><span class="smallMuted">Manual + GHL · last 30 days of GHL history</span></div>${chartPanel()}</section><section class="panel"><div class="panelHead"><h2>Measurement history</h2><span class="smallMuted">${arr.length} records</span></div>${arr.length?`<div class="tableWrap"><table class="dataTable"><thead><tr><th>Date</th><th>Parameter</th><th>Value</th><th>Target</th><th>Notes</th><th class="right">Actions</th></tr></thead><tbody>${arr.map(r=>`<tr><td>${readingDate(r)}</td><td><b>${esc(TYPES[r.type]?.label||r.type)}</b></td><td>${nfmt(r.value)} ${esc(r.unit??unit(r.type))}</td><td>${badge(r.value,r.type)}</td><td>${esc(r.source==='GHL'?'GHL · automatic recording':r.notes||'—')}</td><td class="right">${r.source==='GHL'?'<span class="smallMuted">GHL · read only</span>':`<div class="rowActions"><button class="miniBtn" data-action="edit-reading" data-id="${attr(r.id)}">Edit</button><button class="miniBtn" data-action="delete-reading" data-id="${attr(r.id)}">Delete</button></div>`}</td></tr>`).join('')}</tbody></table></div>`:empty('Your log is empty','Record a measurement or connect GHL to start tracking water parameters and flow.')}</section>`}
function maintenance(){const tasks=[...db.tasks].filter(x=>taskFilter==='all'||(taskFilter==='open'?!x.complete:x.complete));const activities=[...db.activities].sort((a,b)=>String(b.date).localeCompare(String(a.date)));return heading('Maintenance','Recurring tasks, water changes and natural seawater delivery records.',button('+ Log activity','new-activity')+button('+ Add task','new-task',true))+
 `${db.tasks.some(t=>t.servicePlan&&!t.last)?'<div class="noteBox topNote">Service schedule added. Last service dates are unknown, so new tasks are due for an initial review today. Edit due dates to match your records; mark Done only after completing the service. Stagger the two return-pump services.</div>':''}<div class="cols"><section class="panel"><div class="panelHead"><h2>Maintenance schedule</h2><div class="inlineControl"><select id="taskFilter" class="select" style="width:auto"><option value="open" ${taskFilter==='open'?'selected':''}>Open tasks</option><option value="all" ${taskFilter==='all'?'selected':''}>All tasks</option><option value="complete" ${taskFilter==='complete'?'selected':''}>Completed</option></select></div></div>${tasks.length?tasks.sort((a,b)=>String(a.next).localeCompare(String(b.next))).map(t=>`<div class="statRow"><div><b>${esc(t.name)}</b><div class="meta">${t.servicePlan&&!t.last?'Initial review · ':''}${t.complete?'Completed':t.next?`Next: ${formatDate(t.next)}`:'Not scheduled'} · ${t.interval?`Every ${t.interval} days`:'One-off'}${t.notes?' · '+esc(t.notes):''}</div></div><div class="rowActions">${!t.complete?`<button class="miniBtn" data-action="finish-task" data-id="${attr(t.id)}">Done</button>`:''}<button class="miniBtn" data-action="edit-task" data-id="${attr(t.id)}">Edit</button><button class="miniBtn" data-action="delete-task" data-id="${attr(t.id)}">×</button></div></div>`).join(''):empty('No tasks here','Add your recurring maintenance jobs.')}</section>
 <section class="panel"><div class="panelHead"><h2>Water-change snapshot</h2></div>${activitySnapshot(activities)}<div class="noteBox spaced">Record incoming NSW deliveries separately from water changes. Only a water-change entry counts as water exchanged; a delivery alone does not change aquarium chemistry.</div></section></div><section class="panel"><div class="panelHead"><h2>Maintenance & delivery history</h2><span class="smallMuted">${activities.length} records</span></div>${activities.length?`<div class="tableWrap"><table class="dataTable"><thead><tr><th>Date</th><th>Activity</th><th>Volume</th><th>Notes</th><th class="right">Actions</th></tr></thead><tbody>${activities.map(r=>`<tr><td>${formatDate(r.date)}</td><td><b>${esc(r.type)}</b></td><td>${r.litres?nfmt(r.litres)+' L':'—'}</td><td>${esc(r.source==='GHL'?'GHL · automatic recording':r.notes||'—')}</td><td class="right"><div class="rowActions"><button class="miniBtn" data-action="edit-activity" data-id="${attr(r.id)}">Edit</button><button class="miniBtn" data-action="delete-activity" data-id="${attr(r.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`:empty('No logged activity','Record your next water change or equipment maintenance.')}</section>`}
function activitySnapshot(a){const changes=a.filter(x=>x.type==='Water change');const deliveries=a.filter(x=>x.type==='Natural seawater delivery');const sum=xs=>xs.reduce((s,x)=>s+Number(x.litres||0),0);return `<div class="statRow"><div><b>Water changed (all logged)</b><div class="meta">${changes.length} recorded events</div></div><b>${nfmt(sum(changes))} L</b></div><div class="statRow"><div><b>NSW received (all logged)</b><div class="meta">${deliveries.length} recorded deliveries</div></div><b>${nfmt(sum(deliveries))} L</b></div><div class="statRow"><div><b>Last water change</b></div><b>${changes.length?formatDate(changes[0].date):'Not recorded'}</b></div>`}
function equipment(){return heading('Equipment register','Service intervals and inventory for the filtration and life-support system.',button('+ Add equipment','new-equipment',true))+
 `<div class="tileGrid">${db.equipment.length?db.equipment.map(e=>{const next=e.service&&e.last?afterDays(e.last,e.service):'';return `<article class="infoTile"><div class="tileHead"><div><div class="tileTitle">${esc(e.name)}</div><div class="tileDetail">${esc(e.category||'Other')} · Quantity ${nfmt(e.quantity||1)}</div></div><span class="tag">Inventory</span></div><div class="tileDetail">Installed: ${formatDate(e.installed)}<br>Service: ${next?formatDate(next):'Not scheduled'}${e.notes?'<br>'+esc(e.notes):''}</div><div class="tileFoot"><span class="smallMuted">${e.service?`Every ${e.service} days`:'No interval'}</span><div class="rowActions"><button class="miniBtn" data-action="edit-equipment" data-id="${attr(e.id)}">Edit</button><button class="miniBtn" data-action="delete-equipment" data-id="${attr(e.id)}">Delete</button></div></div></article>`}).join(''):empty('No equipment','Add your pumps, lights and filtration hardware.')}</div>`}
function livestock(){const list=db.livestock.filter(x=>livestockFilter==='all'||x.status===livestockFilter),count=db.livestock.filter(x=>x.status==='current').reduce((sum,x)=>sum+Number(x.quantity||0),0);return heading('Livestock register','Track your current stock, losses and potential additions.',button('+ Add livestock','new-livestock',true))+
 `<div class="noteBox topNote">Starting records contain a provisional transferred-fish cohort and clean-up crew. Review the species and quantities before treating the totals as accurate.</div><div class="split" style="margin-bottom:15px"><div class="kpiLine"><b>${nfmt(count)}</b><span class="subtle">counted/estimated animals (some quantities unknown)</span></div></div><div class="pillTabBar">${[['all','All'],['current','Current'],['planned','Planned'],['lost','Lost']].map(([k,v])=>`<button class="pillTab ${livestockFilter===k?'active':''}" data-action="stock-filter" data-id="${k}">${v}</button>`).join('')}</div><div class="tileGrid">${list.length?list.map(s=>`<article class="infoTile"><div class="tileHead"><div><div class="tileTitle">${esc(s.name)}</div><div class="tileDetail">${esc(s.kind)} · Quantity ${s.quantity==null?'Unknown':nfmt(s.quantity)}</div></div><span class="tag ${s.status==='planned'?'planned':s.status==='lost'?'lost':''}">${esc(s.status)}</span></div><div class="tileDetail">${s.added?'Added / recorded: '+formatDate(s.added):'Date not recorded'}${s.notes?'<br>'+esc(s.notes):''}</div><div class="tileFoot"><span class="smallMuted">${esc(s.kind)}</span><div class="rowActions"><button class="miniBtn" data-action="edit-livestock" data-id="${attr(s.id)}">Edit</button><button class="miniBtn" data-action="delete-livestock" data-id="${attr(s.id)}">Delete</button></div></div></article>`).join(''):empty('No matching stock','Choose another filter or add a new entry.')}</div>`}
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
 if(mode==='activity')body=options('type','Activity',[['Water change','Water change'],['Natural seawater delivery','Natural seawater delivery'],['Equipment service','Equipment service'],['Coral maintenance','Coral maintenance'],['Algae removal','Algae removal'],['Other','Other']],entry?.type||'Water change')+field('date','Date',entry?.date||localDate(),'date','required')+field('litres','Volume (L; if applicable)',entry?.litres||'','number','min="0" step="0.1"')+notes(entry?.notes);
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
  const v=obj.litres===''?null:Number(obj.litres);if(v!==null&&(!Number.isFinite(v)||v<0))return alert('Please enter a valid volume.');Object.assign(record,{type:obj.type,date:obj.date,litres:v,notes:value(obj.notes)});
 } else if(mode==='equipment'){
  if(!value(obj.name))return alert('Please enter an equipment name.');Object.assign(record,{name:value(obj.name),category:obj.category,quantity:Number(obj.quantity),installed:obj.installed,service:Number(obj.service||0),last:obj.last,notes:value(obj.notes)});
 } else if(mode==='livestock'){
  if(!value(obj.name))return alert('Please enter a species or name.');Object.assign(record,{name:value(obj.name),kind:obj.kind,quantity:obj.quantity===''?null:Number(obj.quantity),status:obj.status,added:obj.added,notes:value(obj.notes)});
 }
 if(old){db[cfg.collection]=db[cfg.collection].map(x=>x.id===old.id?record:x)}else db[cfg.collection].push(record);
 if(save()){closeModal();page=cfg.page;render();toast('Record saved');}
}
function finishTask(taskId){const t=db.tasks.find(x=>x.id===taskId);if(!t)return;const when=localDate();db.activities.push({id:id(),type:'Equipment service',date:when,litres:null,notes:`Completed task: ${t.name}`});t.last=when;if(t.interval>0){t.next=afterDays(when,t.interval);t.complete=false;}else{t.next='';t.complete=true;}if(save()){render();toast('Maintenance logged')};}
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
function handleAction(action,rid){if(action==='close-modal'){closeModal();return}if(action==='new-reading'){showModal('reading');return}if(action==='new-task'){showModal('task');return}if(action==='new-activity'){showModal('activity');return}if(action==='new-equipment'){showModal('equipment');return}if(action==='new-livestock'){showModal('livestock');return}
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
document.addEventListener('change',e=>{if(e.target.id==='chartMetric'){metric=e.target.value;render()}else if(e.target.id==='taskFilter'){taskFilter=e.target.value;render()}else if(e.target.id==='importFile'){importBackup(e.target.files?.[0],e.target.dataset.mode||'backup');e.target.value=''}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('modalHost').innerHTML)closeModal()});
document.getElementById('quickBackup').addEventListener('click',exportBackup);
if(ensureServiceSchedule(db))save();
render();
if(window.__storageError)toast('Local storage may be blocked. Check browser settings.');
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('./sw.js').catch(()=>{});

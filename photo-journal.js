/* Reef Command 2.3 — Photo Journal. Self-contained enhancement, no GHL/control changes. */
'use strict';
(() => {
  const DB_NAME = 'reef-command-photo-journal-v1';
  const STORE = 'photos';
  const CFG_KEY = 'reef-command-supabase-config-v2';
  const BUCKET = 'reef-photos';
  const TABLE = 'reef_photo_journal';
  const MAX_INPUT = 25 * 1024 * 1024;
  const MAX_ARCHIVE = 250 * 1024 * 1024;
  const AREAS = {full:'Full tank',left:'Left',centre:'Centre',right:'Right',other:'Other'};
  const safe = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp = s => Number.isFinite(Date.parse(s)) ? Date.parse(s) : 0;
  const today = () => {const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const formatDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—';
  const uid = () => crypto.randomUUID();
  const clone = o => JSON.parse(JSON.stringify(o));
  const statusOrder = {queued:1,deleting:2,synced:3};
  let items = [], client=null, clientKey='', connectedUser=null, refreshing=false, uploading=false, loadError='', notice='', modalPreview=null;
  let filter='all', subjectFilter='all', compareBefore='', compareAfter='', compareMode='side', comparePercent=50, viewMode='grid';
  const previews=new Map(), signedUrls=new Map();
  const validCfg=c=>!!(c&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(c.url)&&typeof c.key==='string'&&c.key.length>20);
  const sorted=()=>items.filter(x=>x.status!=='deleting').sort((a,b)=>b.captured_on.localeCompare(a.captured_on)||b.created_at.localeCompare(a.created_at));

  function openDb(){return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(Error('This browser does not support IndexedDB.'));
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('IndexedDB unavailable'));
  });}
  async function transaction(mode,fn){const d=await openDb();return new Promise((resolve,reject)=>{
    const tx=d.transaction(STORE,mode),request=fn(tx.objectStore(STORE));
    let value; if(request){request.onsuccess=()=>{value=request.result};request.onerror=()=>reject(request.error);}
    tx.oncomplete=()=>{d.close();resolve(value)};
    tx.onerror=()=>{d.close();reject(tx.error||Error('Local photo save failed'))};
    tx.onabort=()=>{d.close();reject(tx.error||Error('Local photo save cancelled'))};
  });}
  const localAll=async()=>await transaction('readonly',s=>s.getAll())||[];
  const localPut=async x=>transaction('readwrite',s=>s.put(x));
  const localDelete=async id=>transaction('readwrite',s=>s.delete(id));

  function alertUser(msg){notice=msg;draw();}
  function revokePreview(id){const old=previews.get(id);if(old)URL.revokeObjectURL(old);previews.delete(id);}
  function photoUrl(p){
    if(p.blob){if(!previews.has(p.id))previews.set(p.id,URL.createObjectURL(p.blob));return previews.get(p.id);}
    const signed=signedUrls.get(p.image_path);return signed&&signed.exp>Date.now()?signed.url:'';
  }
  function photoImage(p,cls='pj-photo',alt='Aquarium progress photo'){
    const url=photoUrl(p);return url?`<img class="${cls}" src="${safe(url)}" alt="${safe(alt)}" loading="lazy">`:
      `<div class="pj-image-placeholder" role="img" aria-label="Photo unavailable offline">Photo available when online</div>`;
  }
  function panelStatus(){const queued=items.filter(p=>p.status==='queued').length,deleted=items.filter(p=>p.status==='deleting').length;
    return queued?`${queued} photo${queued===1?'':'s'} awaiting upload`:(deleted?`${deleted} pending deletion${deleted===1?'':'s'}`:'Cloud photos synced');}
  function subjects(){return [...new Set(items.filter(p=>p.status!=='deleting').map(p=>p.subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
  function visible(){return sorted().filter(p=>(filter==='all'||p.area===filter)&&(subjectFilter==='all'||p.subject===subjectFilter));}
  const subjectName=p=>p.subject || p.title || 'Unnamed coral';

  function pageHtml(){
    const list=visible(), total=sorted().length, groups=subjects();
    const actions=`<button class="btn primary" type="button" data-pj="add">+ Add photo</button><button class="btn" type="button" data-pj="archive">Download photo archive</button>`;
    const headline=`<div class="pageTitle"><div><h1>Photo Journal</h1><p>Track coral growth, colour and aquarium maturity without maintaining a full coral inventory.</p></div><div class="actions">${actions}</div></div>`;
    const options=(vals,current)=>vals.map(([v,t])=>`<option value="${safe(v)}" ${v===current?'selected':''}>${safe(t)}</option>`).join('');
    const filters=`<section class="panel pj-toolbar"><div class="pj-filters"><div class="field"><label for="pj-area">Area</label><select class="select" id="pj-area">${options([['all','All areas'],...Object.entries(AREAS)],filter)}</select></div><div class="field"><label for="pj-subject">Subject</label><select class="select" id="pj-subject">${options([['all','All subjects'],...groups.map(g=>[g,g])],subjectFilter)}</select></div><div class="field"><label for="pj-view">Display</label><select class="select" id="pj-view">${options([['grid','Photo grid'],['timeline','Timeline']],viewMode)}</select></div></div><p class="help">${safe(total)} photograph${total===1?'':'s'} · ${safe(panelStatus())}. Monthly photographs from consistent angles work best.</p></section>`;
    const cards=list.length?`<div class="pj-grid ${viewMode==='timeline'?'pj-timeline':''}">${list.map(p=>`<article class="pj-card"><button class="pj-photoButton" type="button" data-pj="view" data-id="${safe(p.id)}" aria-label="View ${safe(subjectName(p))}">${photoImage(p,'pj-cardImage',subjectName(p))}</button><div class="pj-cardText"><div class="pj-overline">${safe(formatDate(p.captured_on))} · ${safe(AREAS[p.area]||p.area)}</div><h3>${safe(subjectName(p))}</h3>${p.title&&p.title!==p.subject?`<p>${safe(p.title)}</p>`:''}${p.notes?`<p class="pj-note">${safe(p.notes)}</p>`:''}<div class="pj-cardFoot"><span class="status ${p.status==='queued'?'warn':''}">${p.status==='queued'?'Awaiting sync':'Saved'}</span><button type="button" class="miniBtn" data-pj="edit" data-id="${safe(p.id)}">Edit</button><button type="button" class="miniBtn" data-pj="delete" data-id="${safe(p.id)}">Delete</button></div></div></article>`).join('')}</div>`:
       `<section class="panel"><div class="empty"><b>No photos in this view</b>Add a full-tank image or photograph a coral to establish a baseline.</div></section>`;
    const message=notice?`<div class="pj-alert" role="status">${safe(notice)} <button type="button" class="miniBtn" data-pj="dismiss">Dismiss</button></div>`:'';
    return `${headline}${message}<section class="panel pj-intro"><div><h2>Build a visual growth record</h2><p>Start with your elegance coral, hammer, candy cane, montipora, blue maxima clam, or the full tank. Identification is optional.</p></div><button type="button" class="btn" data-pj="refresh">Refresh cloud photos</button></section>${filters}${compareHtml()}${cards}<section class="panel"><div class="panelHead"><h2>Photo backups</h2></div><p class="subtle">Images are stored privately in Supabase Storage and locally on this device when uploaded here. Your existing Reef Command JSON backup does <strong>not</strong> contain photo files. Download a separate photo archive periodically; the archive includes images and their metadata and can be restored here.</p><div class="actions"><button type="button" class="btn" data-pj="archive">Download photo archive (.zip)</button><button type="button" class="btn" data-pj="import">Restore photo archive (.zip)</button></div><p class="help">Cloud setup requires a one-time SQL migration. Sign in to Supabase in Settings before uploading or restoring photos.</p></section>`;
  }
  function compareHtml(){
    const photos=visible();if(photos.length<2)return '';
    const choices=photos.map(p=>`<option value="${safe(p.id)}">${safe(formatDate(p.captured_on))} · ${safe(subjectName(p))} (${safe(AREAS[p.area])})</option>`).join('');
    if(!photos.some(p=>p.id===compareBefore))compareBefore=photos[photos.length-1].id;
    if(!photos.some(p=>p.id===compareAfter))compareAfter=photos[0].id;
    const before=photos.find(p=>p.id===compareBefore),after=photos.find(p=>p.id===compareAfter);
    const bUrl=before?photoUrl(before):'',aUrl=after?photoUrl(after):'';
    const select=(id,val)=>`<select class="select" id="${id}">${choices.replaceAll(`value="${safe(val)}"`,`value="${safe(val)}" selected`)}</select>`;
    return `<section class="panel pj-compare"><div class="panelHead"><h2>Growth comparison</h2><div class="actions"><button class="btn small ${compareMode==='side'?'primary':''}" type="button" data-pj="mode-side">Side by side</button><button class="btn small ${compareMode==='slider'?'primary':''}" type="button" data-pj="mode-slider">Overlay slider</button></div></div><div class="pj-compareControls"><div class="field"><label for="pj-compare-before">Earlier photo</label>${select('pj-compare-before',compareBefore)}</div><div class="field"><label for="pj-compare-after">Later photo</label>${select('pj-compare-after',compareAfter)}</div></div>${bUrl&&aUrl?(compareMode==='side'?`<div class="pj-sideBySide"><figure>${photoImage(before,'pj-compareImage',subjectName(before))}<figcaption>Earlier · ${safe(formatDate(before.captured_on))}</figcaption></figure><figure>${photoImage(after,'pj-compareImage',subjectName(after))}<figcaption>Later · ${safe(formatDate(after.captured_on))}</figcaption></figure></div>`:
      `<div class="pj-overlay" style="--pj-reveal:${comparePercent}%"><img src="${safe(bUrl)}" alt="Earlier photograph"><div class="pj-overlayAfter"><img src="${safe(aUrl)}" alt="Later photograph"></div><div class="pj-overlayLine" aria-hidden="true"></div></div><div class="pj-compareLabels"><span>${safe(formatDate(before.captured_on))}</span><span>${safe(formatDate(after.captured_on))}</span></div><label class="pj-sliderLabel" for="pj-comparison">Reveal later image: ${comparePercent}%</label><input class="pj-slider" id="pj-comparison" type="range" min="0" max="100" value="${comparePercent}" aria-label="Reveal later photograph">`):`<div class="empty">Both photos must be available on this device or loaded from the cloud to compare.</div>`}<p class="help">Match distance, angle and light intensity for the most useful growth comparison.</p></section>`;
  }
  function draw(){if(typeof page==='undefined'||page!=='photos')return;const node=document.getElementById('content');if(node){node.innerHTML=pageHtml();document.title='Photo Journal · Reef Command';}}

  async function getClient(){
    const raw=localStorage.getItem(CFG_KEY);let cfg;try{cfg=JSON.parse(raw||'null')}catch{}
    if(!validCfg(cfg))throw Error('Connect Supabase from Reef Command Settings first.');
    if(!window.supabase?.createClient)throw Error('Supabase library is unavailable; check your connection.');
    const key=cfg.url+'|'+cfg.key;
    if(!client||key!==clientKey){client=window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});clientKey=key;signedUrls.clear();}
    const {data,error}=await client.auth.getSession();if(error)throw error;
    connectedUser=data?.session?.user?.id||null;
    if(!connectedUser)throw Error('Sign in to Supabase in Reef Command Settings first.');
    return {client,owner:connectedUser};
  }
  function asLocal(row,existing){return {
    id:row.id,owner_id:row.owner_id,created_at:row.created_at||existing?.created_at||new Date().toISOString(),
    captured_on:row.captured_on,title:row.title||'',subject:row.subject||'',area:row.area||'full',notes:row.notes||'',
    image_path:row.image_path||'',status:'synced',blob:existing?.blob||null
  };}
  async function reloadLocal(){items=await localAll();items.sort((a,b)=>stamp(b.created_at)-stamp(a.created_at));draw();}
  async function getSignedImages(rows){
    if(!client||!connectedUser)return;
    const paths=[...new Set(rows.map(r=>r.image_path).filter(Boolean).filter(path=>!signedUrls.has(path)||signedUrls.get(path).exp<Date.now()))];
    for(let i=0;i<paths.length;i+=30){const batch=paths.slice(i,i+30);
      const {data,error}=await client.storage.from(BUCKET).createSignedUrls(batch,3600);
      if(error){console.warn('Photo links:',error);continue;}
      for(const entry of data||[])if(entry.signedUrl&&!entry.error)signedUrls.set(entry.path,{url:entry.signedUrl,exp:Date.now()+3500000});
    }
    draw();
  }
  async function refresh(){if(refreshing)return;refreshing=true;try{
    const {client:c,owner}=await getClient();
    const {data,error}=await c.from(TABLE).select('id,owner_id,created_at,captured_on,title,subject,area,notes,image_path').eq('owner_id',owner).order('captured_on',{ascending:false}).limit(2000);
    if(error)throw error;
    const local=new Map((await localAll()).filter(r=>!r.owner_id||r.owner_id===owner).map(r=>[r.id,r]));
    for(const row of data||[]){const prior=local.get(row.id);if(prior?.status==='deleting'||prior?.status==='queued')continue;const merged=asLocal(row,prior);await localPut(merged);local.set(row.id,merged);}
    // Local synced copies removed from the cloud elsewhere must not reappear.
    const remoteIds=new Set((data||[]).map(r=>r.id));
    for(const row of local.values())if(row.status==='synced'&&!remoteIds.has(row.id)){await localDelete(row.id);revokePreview(row.id);local.delete(row.id);}
    items=[...local.values()];loadError='';await getSignedImages(items);draw();
  }catch(e){loadError=e.message||String(e);if(!items.length)notice='Cloud photos unavailable: '+loadError;draw();}finally{refreshing=false;}}
  async function flush(){if(uploading||!navigator.onLine)return;uploading=true;
    try{const {client:c,owner}=await getClient();const pending=(await localAll()).filter(r=>(r.status==='queued'||r.status==='deleting')&&(!r.owner_id||r.owner_id===owner));
      for(const p of pending){try{
        if(p.status==='deleting'){
          const {error:de}=await c.from(TABLE).delete().eq('owner_id',owner).eq('id',p.id);if(de)throw de;
          if(p.image_path){const {error:se}=await c.storage.from(BUCKET).remove([p.image_path]);if(se)throw se;}
          await localDelete(p.id);revokePreview(p.id);continue;
        }
        if(!p.blob){throw Error('Queued photo is missing its local image; restore from your photo archive.');}
        const path=`${owner}/${p.id}.jpg`;
        const {error:uploadError}=await c.storage.from(BUCKET).upload(path,p.blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:true});
        if(uploadError)throw uploadError;
        const row={id:p.id,owner_id:owner,captured_on:p.captured_on,title:p.title,subject:p.subject,area:p.area,notes:p.notes,image_path:path,created_at:p.created_at};
        const {error:writeError}=await c.from(TABLE).upsert(row,{onConflict:'id'});if(writeError)throw writeError;
        await localPut({...p,status:'synced',owner_id:owner,image_path:path});
      }catch(e){console.warn('Photo upload/deletion pending:',e);notice=`Sync pending for ${p.subject||p.title||'a photo'}: ${e.message||e}`;}}
      await reloadLocal();await refresh();
    }catch(e){loadError=e.message||String(e);draw();}finally{uploading=false;}}

  async function compressImage(file){
    if(file.size>MAX_INPUT)throw Error('Photo is larger than 25 MB. Reduce it before uploading.');
    if(!file.type.startsWith('image/'))throw Error('Select an image file.');
    let image;
    try{image=await createImageBitmap(file)}catch{throw Error('Could not decode this image. Try JPEG, PNG or WebP.');}
    const ratio=Math.min(1,1920/Math.max(image.width,image.height));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.width*ratio));c.height=Math.max(1,Math.round(image.height*ratio));
    const cx=c.getContext('2d');if(!cx){image.close?.();throw Error('Canvas unavailable.');}
    cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(image,0,0,c.width,c.height);image.close?.();
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.84));c.width=c.height=0;
    if(!blob)throw Error('Could not prepare photo.');if(blob.size>8*1024*1024)throw Error('Photo exceeds the cloud storage size limit.');return blob;
  }
  async function savePhoto(form){
    const data=new FormData(form),old=items.find(x=>x.id===form.dataset.id);
    const file=form.querySelector('#pj-file')?.files?.[0];
    if(!old&&!file)throw Error('Choose a photo to upload.');
    const date=String(data.get('captured_on')||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose the photo date.');
    const subject=String(data.get('subject')||'').trim().slice(0,100),title=String(data.get('title')||'').trim().slice(0,100);
    const area=String(data.get('area')||'full');if(!Object.hasOwn(AREAS,area))throw Error('Invalid tank area.');
    let owner=connectedUser;try{owner=(await getClient()).owner}catch(e){if(!old&&navigator.onLine)throw e;}
    if(!old&&!owner)throw Error('Sign in via Settings before adding photos. They can then queue offline.');
    const blob=file?await compressImage(file):old?.blob||null;
    const p={...(old||{}),id:old?.id||uid(),owner_id:old?.owner_id||owner||null,created_at:old?.created_at||new Date().toISOString(),
      captured_on:date,title,subject,area,notes:String(data.get('notes')||'').trim().slice(0,1500),
      image_path:old?.image_path||'',status:'queued',blob};
    // Editing an existing photo downloaded from another device still needs its image.
    if(!p.blob&&old?.image_path){const {client:c}=await getClient();const {data:remote,error}=await c.storage.from(BUCKET).download(old.image_path);if(error)throw Error('Photo must be online to edit metadata: '+error.message);p.blob=remote;}
    await localPut(p);revokePreview(p.id);await reloadLocal();closeModal();notice='Photo saved locally; syncing to private cloud storage.';draw();flush();
  }
  function photoModal(p=null){
    const current=p||{}, opts=Object.entries(AREAS).map(([a,n])=>`<option value="${a}" ${current.area===a?'selected':''}>${n}</option>`).join('');
    return `<div class="modalBackdrop" data-pj="backdrop"><div class="modal"><div class="modalHead"><h2>${p?'Edit photo':'Add progress photo'}</h2><button class="xBtn" type="button" data-pj="close" aria-label="Close">×</button></div><div class="modalBody"><form id="pj-form" data-id="${safe(current.id||'')}"><div class="pj-uploadPreview" id="pj-uploadPreview">${p?photoImage(p,'pj-formImage','Selected photo'):'<p>Choose a photo using your camera or gallery.</p>'}</div><div class="formGrid"><div class="field span2"><label for="pj-file">Photo ${p?'(leave blank to keep current image)':'*'}</label><input class="input" id="pj-file" name="file" type="file" accept="image/*" ${p?'':'required'}></div><div class="field"><label for="pj-date">Photo taken</label><input class="input" type="date" name="captured_on" id="pj-date" required value="${safe(current.captured_on||today())}"></div><div class="field"><label for="pj-photoarea">Tank position</label><select class="select" id="pj-photoarea" name="area">${opts}</select></div><div class="field"><label for="pj-photosubject">Coral / subject (optional)</label><input class="input" id="pj-photosubject" name="subject" maxlength="100" placeholder="e.g. Elegance coral" value="${safe(current.subject||'')}"></div><div class="field"><label for="pj-phototitle">Short label (optional)</label><input class="input" id="pj-phototitle" name="title" maxlength="100" placeholder="e.g. November baseline" value="${safe(current.title||'')}"></div><div class="field span2"><label for="pj-photonotes">Observations</label><textarea class="textarea" id="pj-photonotes" name="notes" maxlength="1500" rows="3" placeholder="Growth, colour, polyp extension, lighting or algae observations">${safe(current.notes||'')}</textarea></div></div><p class="help">Images are resized to a maximum of 1920 pixels before storage to keep storage and uploads manageable.</p><div class="modalFooter"><button type="button" class="btn" data-pj="close">Cancel</button><button class="btn primary" type="submit" id="pj-submit">Save photo</button></div></form></div></div></div>`;
  }
  function viewModal(p){return `<div class="modalBackdrop" data-pj="backdrop"><div class="modal pj-viewModal"><div class="modalHead"><h2>${safe(subjectName(p))}</h2><button class="xBtn" type="button" data-pj="close" aria-label="Close">×</button></div><div class="modalBody">${photoImage(p,'pj-detailImage',subjectName(p))}<div class="pj-detailMetadata"><b>${safe(formatDate(p.captured_on))}</b><span>${safe(AREAS[p.area]||p.area)}</span></div>${p.notes?`<p>${safe(p.notes)}</p>`:''}<div class="modalFooter"><button class="btn" type="button" data-pj="edit" data-id="${safe(p.id)}">Edit details</button><button class="btn" type="button" data-pj="close">Close</button></div></div></div></div>`;}
  function openModal(html){document.getElementById('modalHost').innerHTML=html;document.body.style.overflow='hidden';}
  function closeModal(){document.getElementById('modalHost').innerHTML='';document.body.style.overflow='';if(modalPreview){URL.revokeObjectURL(modalPreview);modalPreview=null;}}

  function crcTable(){const table=new Uint32Array(256);for(let i=0;i<256;i++){let n=i;for(let j=0;j<8;j++)n=(n&1)?(0xedb88320^(n>>>1)):(n>>>1);table[i]=n>>>0;}return table;}
  const crcLookup=crcTable();
  function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcLookup[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
  function uint16(d,o,v){d.setUint16(o,v,true)}function uint32(d,o,v){d.setUint32(o,v>>>0,true)}
  function zipFiles(files){
    if(files.length>65000)throw Error('Too many photos to archive.');let offset=0;const contents=[],central=[];
    for(const file of files){const name=new TextEncoder().encode(file.name),bytes=file.bytes,crc=crc32(bytes);
      if(name.length>65535||bytes.byteLength>0xffffffff||offset>0xffffffff)throw Error('Photo archive exceeds ZIP limits.');
      const head=new Uint8Array(30+name.length),h=new DataView(head.buffer);uint32(h,0,0x04034b50);uint16(h,4,20);uint16(h,8,0);uint32(h,14,crc);uint32(h,18,bytes.length);uint32(h,22,bytes.length);uint16(h,26,name.length);head.set(name,30);
      contents.push(head,bytes);const ch=new Uint8Array(46+name.length),v=new DataView(ch.buffer);
      uint32(v,0,0x02014b50);uint16(v,4,20);uint16(v,6,20);uint32(v,16,crc);uint32(v,20,bytes.length);uint32(v,24,bytes.length);uint16(v,28,name.length);uint32(v,42,offset);ch.set(name,46);central.push(ch);offset+=head.length+bytes.length;
    }
    const cSize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
    uint32(v,0,0x06054b50);uint16(v,8,files.length);uint16(v,10,files.length);uint32(v,12,cSize);uint32(v,16,offset);
    return new Blob([...contents,...central,end],{type:'application/zip'});
  }
  function unzipFiles(buffer){
    const view=new DataView(buffer),src=new Uint8Array(buffer),out=new Map();let offset=0,limit=0;
    while(offset+30<=buffer.byteLength&&view.getUint32(offset,true)===0x04034b50){
      if(++limit>65000)throw Error('Too many archive entries.');
      const flag=view.getUint16(offset+6,true),method=view.getUint16(offset+8,true);
      if(flag!==0||method!==0)throw Error('Unsupported ZIP compression. Restore an archive created by Reef Command.');
      const crc=view.getUint32(offset+14,true),length=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
      const start=offset+30+nameLength+extra,end=start+length;
      if(end>buffer.byteLength)throw Error('Incomplete photo archive.');
      const name=new TextDecoder().decode(src.subarray(offset+30,offset+30+nameLength));const bytes=src.slice(start,end);
      if(crc32(bytes)!==crc)throw Error('Photo archive checksum failed for '+name);
      if(out.has(name))throw Error('Duplicate archive file.');out.set(name,bytes);offset=end;
    }
    return out;
  }
  function download(filename,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function archive(){
    const visible=sorted();if(!visible.length)throw Error('No photos to back up.');
    let total=0;const files=[],manifest={format:'reef-command-photo-archive-v1',created:new Date().toISOString(),photos:[]};
    for(const p of visible){let blob=p.blob;
      if(!blob&&p.image_path){const {client:c}=await getClient();const {data,error}=await c.storage.from(BUCKET).download(p.image_path);if(error)throw Error('Could not download '+subjectName(p)+': '+error.message);blob=data;}
      if(!blob)throw Error('Image unavailable for '+subjectName(p));total+=blob.size;if(total>MAX_ARCHIVE)throw Error('Archive exceeds 250 MB; export photos in smaller batches.');
      const name=`photos/${p.id}.jpg`;files.push({name,bytes:new Uint8Array(await blob.arrayBuffer())});
      manifest.photos.push({id:p.id,captured_on:p.captured_on,subject:p.subject,title:p.title,area:p.area,notes:p.notes,file:name,created_at:p.created_at});
    }
    files.unshift({name:'manifest.json',bytes:new TextEncoder().encode(JSON.stringify(manifest,null,2))});
    download(`reef-command-photos-${today()}.zip`,zipFiles(files));notice=`Downloaded ${visible.length} photos and metadata as a ZIP archive.`;draw();
  }
  async function importArchive(file){
    if(!file) return;if(file.size>MAX_ARCHIVE)throw Error('Archive is larger than 250 MB.');
    const archive=unzipFiles(await file.arrayBuffer()),manifestRaw=archive.get('manifest.json');if(!manifestRaw)throw Error('Missing photo manifest.');
    const m=JSON.parse(new TextDecoder().decode(manifestRaw));if(m.format!=='reef-command-photo-archive-v1'||!Array.isArray(m.photos)||m.photos.length>2000)throw Error('Unsupported photo archive.');
    const {owner}=await getClient();let added=0;const existing=new Set(items.map(p=>p.id));
    for(const p of m.photos){if(!/^photos\/[0-9a-f-]{36}\.jpg$/i.test(p.file||''))throw Error('Invalid archive photo path.');const bytes=archive.get(p.file);if(!bytes||!bytes.length||bytes.length>8*1024*1024)throw Error('Missing or oversized photo in archive.');
      const id=existing.has(p.id)?uid():(/^[0-9a-f-]{36}$/i.test(p.id)?p.id:uid());
      await localPut({id,owner_id:owner,created_at:p.created_at||new Date().toISOString(),captured_on:/^\d{4}-\d{2}-\d{2}$/.test(p.captured_on||'')?p.captured_on:today(),subject:String(p.subject||'').slice(0,100),title:String(p.title||'').slice(0,100),notes:String(p.notes||'').slice(0,1500),area:Object.hasOwn(AREAS,p.area)?p.area:'other',image_path:'',status:'queued',blob:new Blob([bytes],{type:'image/jpeg'})});
      existing.add(id);added++;
    }
    await reloadLocal();notice=`Restored ${added} photos locally. Uploading them to Supabase.`;draw();flush();
  }
  async function deletePhoto(p){if(!confirm(`Delete photo of ${subjectName(p)} dated ${formatDate(p.captured_on)}? This also removes the cloud copy.`))return;
    if(p.status==='queued'&&!p.image_path){await localDelete(p.id);revokePreview(p.id);}else await localPut({...p,status:'deleting'});
    await reloadLocal();flush();}
  async function init(){try{await reloadLocal();await refresh();flush();}catch(e){loadError=e.message||String(e);alertUser('Photo Journal storage unavailable: '+loadError);}}

  // Add a navigation entry using the existing app's global navigation/render pipeline.
  if(typeof NAV!=='undefined'&&!NAV.some(row=>row[0]==='photos'))NAV.splice(NAV.findIndex(row=>row[0]==='settings'),0,['photos','Photo Journal','▧']);
  if(typeof render==='function'){
    const originalRender=render;
    render=function(...args){originalRender(...args);if(page==='photos')draw();if(page==='settings'){
      const settingsEl=document.querySelector('.settingsCards');if(settingsEl&&!document.getElementById('pj-backupReminder'))settingsEl.insertAdjacentHTML('beforebegin','<p class="noteBox" id="pj-backupReminder">Photo Journal images are stored separately from the standard JSON backup. Use Photo Journal → Download photo archive to back up your photographs.</p>');
    }};
    render();
  }
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-pj]');if(!btn)return;
    const action=btn.dataset.pj;if(action==='backdrop'){if(e.target===btn)closeModal();return;}
    if(action==='close'){closeModal();return;}
    const p=items.find(x=>x.id===btn.dataset.id);
    try{
      if(action==='add')openModal(photoModal());
      else if(action==='edit'&&p)openModal(photoModal(p));
      else if(action==='view'&&p)openModal(viewModal(p));
      else if(action==='delete'&&p)await deletePhoto(p);
      else if(action==='dismiss'){notice='';draw();}
      else if(action==='mode-side'||action==='mode-slider'){compareMode=action==='mode-side'?'side':'slider';draw();}
      else if(action==='refresh'){await refresh();await flush();}
      else if(action==='archive'){notice='Preparing the photo archive…';draw();await archive();}
      else if(action==='import')document.getElementById('pj-import-file').click();
    }catch(ex){alertUser(ex.message||String(ex));}
  });
  document.addEventListener('change',async e=>{
    const el=e.target;
    if(el.id==='pj-area'){filter=el.value;draw();}
    if(el.id==='pj-subject'){subjectFilter=el.value;draw();}
    if(el.id==='pj-view'){viewMode=el.value;draw();}
    if(el.id==='pj-compare-before'){compareBefore=el.value;draw();}
    if(el.id==='pj-compare-after'){compareAfter=el.value;draw();}
    if(el.id==='pj-file'&&el.files?.[0]){if(modalPreview)URL.revokeObjectURL(modalPreview);modalPreview=URL.createObjectURL(el.files[0]);const holder=document.getElementById('pj-uploadPreview');if(holder)holder.innerHTML=`<img class="pj-formImage" src="${safe(modalPreview)}" alt="Photo preview">`;}
    if(el.id==='pj-import-file'){const file=el.files?.[0];el.value='';try{await importArchive(file)}catch(ex){alertUser(ex.message||String(ex))}}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='pj-comparison'){comparePercent=Number(e.target.value);const box=document.querySelector('.pj-overlay');if(box)box.style.setProperty('--pj-reveal',comparePercent+'%');const label=document.querySelector('.pj-sliderLabel');if(label)label.textContent=`Reveal later image: ${comparePercent}%`;}
  });
  document.addEventListener('submit',async e=>{
    if(e.target.id!=='pj-form')return;e.preventDefault();const btn=document.getElementById('pj-submit');if(btn)btn.disabled=true;
    try{await savePhoto(e.target)}catch(ex){alertUser(ex.message||String(ex));if(btn)btn.disabled=false;}
  });
  window.addEventListener('online',()=>{refresh();flush();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();flush();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('pj-form'))closeModal();});
  window.ReefPhotos={refresh,flush,archive,importArchive,_test:{zipFiles,unzipFiles,crc32},get count(){return items.length}};
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.zip,application/zip';fileInput.id='pj-import-file';fileInput.hidden=true;document.body.append(fileInput);
  init();
})();

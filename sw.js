/* Reef Command v2.3: online-first app shell, offline fallback; photos use IndexedDB. */
const CACHE='reef-command-v2.3.2-triton-icp';
const ASSETS=['./','./index.html','./styles.css','./app.js','./sync.js','./photo-journal.js','./photo-journal.css','./nav-icons.js','./nav-icons.css','./triton-icp.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-192.png','./icons/maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request, url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 // Do not cache Supabase requests, private signed images, or user photographs.
 if(!url.pathname.startsWith(new URL('./',self.location.href).pathname))return;
 event.respondWith((async()=>{
  try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);cache.put(request,response.clone()).catch(()=>{});}return response;}
  catch{return (await caches.match(request))||Response.error();}
 })());
});

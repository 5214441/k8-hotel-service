const CACHE="k8-hotel-v5-1";
const ASSETS=[
  "./","./index.html?v=5.1","./style.css?v=5.1","./app.js?v=5.1","./config.js?v=5.1",
  "./admin.html?v=5.1","./admin.css?v=5.1","./admin.js?v=5.1",
  "./qr.html?v=5.1","./qr.css?v=5.1","./qr.js?v=5.1",
  "./manifest.webmanifest",
  "./assets/k8-hotel-logo-white.png","./assets/k8-hotel-logo-dark.png",
  "./assets/k8-hotel-symbol-dark.png","./assets/k8-hotel-symbol-white.png"
];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener("activate",e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);
  if(u.pathname.includes("/api/"))return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});

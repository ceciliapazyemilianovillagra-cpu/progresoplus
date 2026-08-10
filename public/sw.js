const CACHE='progreso-plus-v1';const CORE=['/','/manifest.webmanifest','/icon.svg'];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)))});


import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
export function localPwa(): Plugin {
  return {
    name: 'family-local-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = [
        '/index.html',
        '/manifest.webmanifest',
        '/pebbledose-icon.svg',
        '/family-hills.svg',
        '/pebbledose-192.png',
        '/pebbledose-512.png',
        ...Object.keys(bundle)
          .filter((name) => /\.(js|css)$/.test(name))
          .map((name) => `/${name}`),
      ];
      const version = createHash('sha256')
        .update(JSON.stringify(assets))
        .digest('hex')
        .slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CACHE='family-medicine-${version}';const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('family-medicine-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('push',event=>{let message={};try{message=event.data?.json()??{};}catch{}event.waitUntil(self.registration.showNotification(message.title||'PebbleDose',{body:message.body||'Open PebbleDose to review your reminders.',icon:'/pebbledose-192.png',badge:'/pebbledose-192.png',tag:message.tag||'pebbledose-reminder',data:{url:'/kiosk'}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(c=>new URL(c.url).origin===self.location.origin&&new URL(c.url).pathname==='/kiosk');if(client){await client.navigate('/kiosk');return client.focus();}return self.clients.openWindow('/kiosk');}));});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return;}
if(ASSETS.includes(url.pathname))event.respondWith(caches.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request)));
});`,
      });
    },
  };
}

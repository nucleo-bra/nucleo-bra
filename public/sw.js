/* Núcleo BRA · service worker: guarda as telas e arquivos do sistema no aparelho
   para abrir sem internet. Os dados ficam no IndexedDB (src/lib/offline.ts). */
const VERSAO = "__VERSAO__";
const CACHE = "nucleo-" + VERSAO;

// resposta que veio de um redirecionamento ("/x/index.html" → "/x/") não pode
// ser usada para abrir página: guarda uma cópia limpa
async function limpo(r) {
  if (!r.redirected) return r;
  return new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers });
}

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    let lista = [];
    try { lista = await (await fetch("/precache.json?v=" + VERSAO, { cache: "no-store" })).json(); } catch { /* segue com o que der */ }
    for (let i = 0; i < lista.length; i += 20) {
      await Promise.all(lista.slice(i, i + 20).map(async (u) => {
        try {
          // páginas: pede o endereço da pasta ("/crm/") e guarda como "/crm/index.html"
          const alvo = u.endsWith("/index.html") ? u.slice(0, -"index.html".length) : u;
          const r = await fetch(alvo, { cache: "reload" });
          if (r.ok) await c.put(u, await limpo(r));
        } catch { /* segue */ }
      }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("nucleo-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// "/crm/" e "/crm/?aba=x" abrem o mesmo arquivo /crm/index.html
function chavePagina(url) {
  let p = url.pathname;
  if (!p.endsWith("/") && !/\.[a-z0-9]+$/i.test(p)) p += "/";
  return p.endsWith("/") ? p + "index.html" : p;
}

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                      // Supabase e afins: direto na rede
  if (url.pathname === "/versao.json" || url.pathname === "/precache.json" || url.pathname === "/sw.js") return;

  // páginas: rede primeiro (sempre a versão nova), sem internet a guardada
  if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
    ev.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(req, { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) c.put(chavePagina(url), await limpo(r.clone()));
        return r;
      } catch {
        return (await c.match(chavePagina(url))) || (await c.match("/index.html")) || new Response("Sem internet e esta página ainda não foi guardada.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // dados das telas para a navegação do Next (index.txt?_rsc=…): rede primeiro, sem internet o guardado
  if (url.pathname.endsWith(".txt")) {
    ev.respondWith((async () => {
      const c = await caches.open(CACHE);
      try { const r = await fetch(req); if (r.ok) c.put(url.pathname, await limpo(r.clone())); return r; }
      catch { return (await c.match(url.pathname)) || new Response("", { status: 504 }); }
    })());
    return;
  }

  // arquivos do sistema (_next, fontes, imagens, financeiro): guardado primeiro, atualiza por trás
  ev.respondWith((async () => {
    const c = await caches.open(CACHE);
    const salvo = await c.match(req, { ignoreSearch: url.pathname.startsWith("/_next/") });
    const daRede = fetch(req).then(async (r) => { if (r.ok && r.type === "basic") c.put(req, await limpo(r.clone())); return r; }).catch(() => null);
    if (salvo) { ev.waitUntil(daRede); return salvo; }
    return (await daRede) || new Response("", { status: 504 });
  })());
});

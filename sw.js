// Service worker das Contas do Mês: guarda a app para funcionar sem internet.
// Ao publicar uma versão nova, muda o número em VERSAO.
const VERSAO = "contas-v11";
const BASE = ["./", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// A Cloudflare redireciona /index.html para /. Uma resposta redirecionada não pode ser usada numa navegação, por isso é copiada.
const limpar = res => !res || !res.redirected ? res
  : res.blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }));

const comLimite = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  // Página: tenta a internet primeiro (para receber atualizações) e usa a cópia guardada se não houver rede.
  if (r.mode === "navigate") {
    e.respondWith(comLimite(fetch(r), 4000)
      .then(res => { if (res.ok) { const c = res.clone(); caches.open(VERSAO).then(x => x.put("./", c)); } return res; })
      .catch(() => caches.match("./").then(limpar)));
    return;
  }
  // Ícones, fontes e restantes ficheiros: usa a cópia guardada e vai buscar à internet só se faltar.
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {
    if (res.ok || res.type === "opaque") { const c = res.clone(); caches.open(VERSAO).then(x => x.put(r, c)); }
    return res;
  })));
});

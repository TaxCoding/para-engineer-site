// Memilih backend: Cloudflare Worker (api.para.engineer) kalau apiUrl terisi, selain itu mode demo.
import { config } from '../config.js';

export const isDemo = !config.apiUrl;
export const api = isDemo
  ? (await import('./demo.js')).createDemoApi()
  : (await import('./edge.js')).createEdgeApi(config);

const cache = { content: null, projects: null, at: 0 };
const TTL = 60_000;
let inflightBootstrap = null;

export function invalidate() {
  cache.content = null;
  cache.projects = null;
  cache.at = 0;
  inflightBootstrap = null;
}

async function loadBootstrap() {
  if (cache.content && cache.projects && Date.now() - cache.at < TTL) {
    return { content: cache.content, projects: cache.projects };
  }
  if (!inflightBootstrap && typeof api.bootstrap === 'function') {
    inflightBootstrap = api
      .bootstrap()
      .then((res) => {
        cache.content = res.content;
        cache.projects = res.projects;
        cache.at = Date.now();
        return res;
      })
      .finally(() => {
        inflightBootstrap = null;
      });
  }
  return inflightBootstrap;
}

export async function getContentCached() {
  if (cache.content && Date.now() - cache.at < TTL) return cache.content;
  if (typeof api.bootstrap === 'function') {
    const res = await loadBootstrap();
    return res.content;
  }
  cache.content = api.getContent().catch((e) => { cache.content = null; throw e; });
  cache.at = Date.now();
  return cache.content;
}

export async function getPublishedCached() {
  if (cache.projects && Date.now() - cache.at < TTL) return cache.projects;
  if (typeof api.bootstrap === 'function') {
    const res = await loadBootstrap();
    return res.projects;
  }
  cache.projects = api.listProjects({ all: false }).catch((e) => { cache.projects = null; throw e; });
  cache.at = Date.now();
  return cache.projects;
}
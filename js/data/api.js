// Memilih backend: Supabase kalau config terisi, selain itu mode demo.
import { config } from '../config.js';
import { createSupabaseApi } from './supabase.js';
import { createDemoApi } from './demo.js';

export const isDemo = !(config.supabaseUrl && config.supabaseAnonKey);
export const api = isDemo ? createDemoApi() : createSupabaseApi(config);

// cache ringan agar navigasi terasa instan
const cache = { content: null, projects: null, at: 0 };
const TTL = 60_000;

export function invalidate() {
  cache.content = null;
  cache.projects = null;
  cache.at = 0;
}

export async function getContentCached() {
  if (cache.content && Date.now() - cache.at < TTL) return cache.content;
  cache.content = api.getContent().catch((e) => { cache.content = null; throw e; });
  cache.at = Date.now();
  return cache.content;
}

export async function getPublishedCached() {
  if (cache.projects && Date.now() - cache.at < TTL) return cache.projects;
  cache.projects = api.listProjects({ all: false }).catch((e) => { cache.projects = null; throw e; });
  cache.at = Date.now();
  return cache.projects;
}

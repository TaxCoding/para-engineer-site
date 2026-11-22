// Klien Supabase ringan (tanpa library): Auth (GoTrue), REST (PostgREST), Storage.
// Hanya memakai fetch → tidak butuh CDN / bundler.
import { mergeContent, CONTENT_KEYS } from './defaults.js';
import { uid } from '../lib/util.js';

const SESSION_KEY = 'pe_session_v1';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createSupabaseApi(cfg) {
  const url = cfg.supabaseUrl.replace(/\/+$/, '');
  const key = cfg.supabaseAnonKey;
  const bucket = cfg.bucket || 'media';

  let session = null; // {access_token, refresh_token, expires_at, user:{id,email}}
  let admin = false;
  const listeners = new Set();
  let refreshing = null;

  const emit = () => listeners.forEach((cb) => cb(api.session()));
  const saveSession = () => {
    try {
      session ? localStorage.setItem(SESSION_KEY, JSON.stringify(session)) : localStorage.removeItem(SESSION_KEY);
    } catch {}
  };

  const mediaUrl = (path) =>
    path ? `${url}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}` : '';

  // ---------- auth ----------
  async function authFetch(grant, body) {
    const res = await fetch(`${url}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(j.error_description || j.msg || j.message || 'Sign in failed', res.status, j.error_code);
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      user: { id: j.user?.id, email: j.user?.email },
    };
  }

  async function getToken() {
    if (!session) return null;
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    refreshing ||= authFetch('refresh_token', { refresh_token: session.refresh_token })
      .then((s) => {
        session = s;
        saveSession();
        return s.access_token;
      })
      .catch(() => {
        session = null;
        admin = false;
        saveSession();
        emit();
        return null;
      })
      .finally(() => (refreshing = null));
    return refreshing;
  }

  // ---------- REST ----------
  async function rest(path, { method = 'GET', body, headers = {}, keepalive = false } = {}) {
    const token = await getToken();
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method,
      keepalive,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token || key}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new ApiError(e.message || res.statusText || 'Request failed', res.status, e.code);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const rpc = (fn, args = {}) => rest(`rpc/${fn}`, { method: 'POST', body: args });

  // ---------- storage ----------
  async function upload(path, blob) {
    const token = await getToken();
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${token || key}`,
        'Content-Type': blob.type || 'application/octet-stream',
        'x-upsert': 'true',
        'cache-control': 'max-age=31536000',
      },
      body: blob,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new ApiError(e.message || e.error || 'Upload failed', res.status);
    }
    return { path, url: mediaUrl(path) };
  }

  async function removeObjects(paths) {
    const list = [...new Set(paths.filter(Boolean))];
    if (!list.length) return;
    const token = await getToken();
    await fetch(`${url}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: list }),
    }).catch(() => {});
  }

  // ---------- mapping ----------
  function mapProject(r) {
    const images = (r.project_images || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        id: i.id,
        path: i.path,
        url: mediaUrl(i.path),
        isCover: !!i.is_cover,
        width: i.width,
        height: i.height,
      }));
    const links = (r.project_links || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({ id: l.id, type: l.type, label: l.label || '', url: l.url }));
    const cover = images.find((i) => i.isCover) || images[0] || null;
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      shortDescription: r.short_description || '',
      fullDescription: r.full_description || '',
      status: r.status,
      imageRatio: r.image_ratio || '16:9',
      images,
      links,
      cover,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  const SELECT = 'select=*,project_images(*),project_links(*)&project_images.order=sort_order.asc&project_links.order=sort_order.asc';

  // ---------- API ----------
  const api = {
    mode: 'supabase',

    async init() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) session = JSON.parse(raw);
      } catch {}
      if (session) {
        const t = await getToken();
        if (t) {
          try {
            admin = (await rpc('is_admin')) === true;
          } catch {
            admin = false;
          }
          if (!admin) {
            // sesi valid tapi bukan admin → keluarkan
            session = null;
            saveSession();
          }
        }
      }
    },

    session() {
      return session && admin ? { id: session.user.id, email: session.user.email } : null;
    },
    isAdmin: () => !!(session && admin),
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async signIn(email, password) {
      session = await authFetch('password', { email: String(email).trim(), password });
      saveSession();
      let ok = false;
      try {
        ok = (await rpc('is_admin')) === true;
      } catch {}
      if (!ok) {
        session = null;
        admin = false;
        saveSession();
        throw new ApiError('This account is not an admin.', 403);
      }
      admin = true;
      emit();
      api.logAuth('login').catch(() => {});
      return api.session();
    },

    async signOut() {
      const token = session?.access_token;
      await api.logAuth('logout').catch(() => {});
      session = null;
      admin = false;
      saveSession();
      emit();
      if (token) {
        fetch(`${url}/auth/v1/logout`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}` } }).catch(() => {});
      }
    },

    // ----- konten situs -----
    async getContent() {
      const rows = await rest('site_content?select=key,value');
      const map = {};
      (rows || []).forEach((r) => (map[r.key] = r.value));
      return mergeContent(map);
    },
    async saveContent(k, value) {
      if (!CONTENT_KEYS.includes(k)) throw new Error('Unknown content key');
      await rest('site_content?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: { key: k, value },
      });
    },

    // ----- proyek -----
    async listProjects({ all = false } = {}) {
      const rows = await rest(`projects?${SELECT}&order=created_at.desc${all ? '' : '&status=eq.published'}`);
      return (rows || []).map(mapProject);
    },
    async getProject({ slug, id }) {
      const filter = id ? `id=eq.${encodeURIComponent(id)}` : `slug=eq.${encodeURIComponent(slug)}`;
      const rows = await rest(`projects?${SELECT}&${filter}&limit=1`);
      return rows?.[0] ? mapProject(rows[0]) : null;
    },

    // draft: {id?, slug, title, shortDescription, fullDescription, status, imageRatio,
    //         links:[{type,label,url}], images:[{id,url,path?,blob?,oldPath?,width,height,isCover}],
    //         removedPaths:[string]}
    async saveProject(draft) {
      const id = draft.id || uid();
      const uploaded = [];
      try {
        const images = [];
        for (const img of draft.images) {
          let path = img.path;
          if (img.blob) {
            const ext = img.blob.type === 'image/png' ? 'png' : img.blob.type === 'image/jpeg' ? 'jpg' : 'webp';
            path = `projects/${id}/${img.id}-${Date.now().toString(36)}.${ext}`;
            await upload(path, img.blob);
            uploaded.push(path);
          }
          images.push({ id: img.id, path, is_cover: !!img.isCover, width: img.width || null, height: img.height || null });
        }

        await rpc('save_project', {
          p: {
            id,
            slug: draft.slug,
            title: draft.title,
            short_description: draft.shortDescription,
            full_description: draft.fullDescription,
            status: draft.status,
            image_ratio: draft.imageRatio,
            images,
            links: draft.links.map((l) => ({ type: l.type, label: l.label || '', url: l.url })),
          },
        });
      } catch (err) {
        await removeObjects(uploaded);
        if (err.code === '23505') throw new ApiError('That slug is already used by another project.', 409, err.code);
        throw err;
      }
      await removeObjects(draft.removedPaths || []);
      return id;
    },

    async deleteProject(project) {
      await rest(`projects?id=eq.${encodeURIComponent(project.id)}`, { method: 'DELETE' });
      await removeObjects(project.images.map((i) => i.path));
    },

    // ----- media situs (foto about) -----
    async uploadMedia(blob, folder = 'site') {
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
      return upload(`${folder}/${uid()}.${ext}`, blob);
    },
    deleteMedia: (paths) => removeObjects(paths),
    mediaUrl,

    // ----- analitik & log -----
    async track(evt) {
      await rest('analytics_events', {
        method: 'POST',
        keepalive: true,
        headers: { Prefer: 'return=minimal' },
        body: {
          type: evt.type,
          path: String(evt.path || '/').slice(0, 300),
          project_id: evt.projectId || null,
          referrer: evt.referrer ? String(evt.referrer).slice(0, 200) : null,
          visitor_id: evt.visitorId,
          session_id: evt.sessionId,
          device: evt.device,
          browser: evt.browser,
          label: evt.label ? String(evt.label).slice(0, 120) : null,
          target_url: evt.targetUrl ? String(evt.targetUrl).slice(0, 300) : null,
        },
      });
    },
    analytics: ({ days = 30, tz = 'UTC' } = {}) => rpc('analytics_summary', { p_days: days, p_tz: tz }),

    async logs({ limit = 50, before } = {}) {
      const rows = await rest(
        `activity_logs?select=*&order=created_at.desc&limit=${limit}${before ? `&created_at=lt.${encodeURIComponent(before)}` : ''}`
      );
      return (rows || []).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        actor: r.actor_email,
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        summary: r.summary,
      }));
    },
    async logAuth(action) {
      await rpc('log_activity', { p_action: action, p_entity: 'auth', p_entity_id: null, p_summary: action === 'login' ? 'Signed in' : 'Signed out' });
    },
  };

  return api;
}

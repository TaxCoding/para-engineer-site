// Klien API ringan untuk Cloudflare Worker (api.para.engineer)
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

export function createEdgeApi(cfg) {
  const baseUrl = cfg.apiUrl.replace(/\/+$/, '');

  let session = null; // { access_token, refresh_token, expires_at, user: { id, email } }
  let admin = false;
  const listeners = new Set();
  let refreshing = null;

  const emit = () => listeners.forEach((cb) => cb(api.session()));
  const saveSession = () => {
    try {
      session ? localStorage.setItem(SESSION_KEY, JSON.stringify(session)) : localStorage.removeItem(SESSION_KEY);
    } catch {}
  };

  // Mengarahkan semua path media (termasuk URL lama Supabase jika masih tersimpan di JSON) lewat Edge Proxy
  const mediaUrl = (path) => {
    if (!path) return '';
    const legacyMarker = '/storage/v1/object/public/media/';
    const idx = path.indexOf(legacyMarker);
    const cleanPath = idx !== -1 ? decodeURIComponent(path.slice(idx + legacyMarker.length)) : path;

    if (/^(https?:\/\/|data:|blob:)/i.test(cleanPath)) return cleanPath;
    return `${baseUrl}/v1/media/${cleanPath.split('/').map(encodeURIComponent).join('/')}`;
  };

  // ---------- Auth ----------
  async function authFetch(endpoint, body) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(j.error || res.statusText || 'Authentication failed', res.status, j.code);
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at,
      user: { id: j.user?.id, email: j.user?.email },
    };
  }

  async function getToken() {
    if (!session) return null;
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    refreshing ||= authFetch('/v1/auth/refresh', { refresh_token: session.refresh_token })
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

  // ---------- HTTP Helper ----------
  async function apiFetch(path, { method = 'GET', body, auth = false, keepalive = false } = {}) {
    const token = auth ? await getToken() : null;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      keepalive,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new ApiError(e.error || res.statusText || 'Request failed', res.status, e.code);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // ---------- Storage ----------
  async function uploadBlob(path, blob) {
    const token = await getToken();
    const res = await fetch(`${baseUrl}/v1/admin/media?path=${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': blob.type || 'application/octet-stream',
      },
      body: blob,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(j.error || 'Upload failed', res.status);
    return { path, url: mediaUrl(path) };
  }

  async function removeObjects(paths) {
    const list = [...new Set((paths || []).filter(Boolean))];
    if (!list.length) return;
    await apiFetch('/v1/admin/media', {
      method: 'DELETE',
      auth: true,
      body: { paths: list },
    }).catch(() => {});
  }

  // ---------- Mapping ----------
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
      deployConfig: r.deploy_config || null,
    };
  }

function normalizeContentUrls(node) {
    if (typeof node === 'string') {
      return node.includes('/storage/v1/object/public/media/') ? mediaUrl(node) : node;
    }
    if (Array.isArray(node)) return node.map(normalizeContentUrls);
    if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        node[k] = normalizeContentUrls(node[k]);
      }
    }
    return node;
  }

  // ---------- API ----------
  const api = {
    mode: 'edge',
    // ----- Deploy Firmware (GitHub .build/*.bin) -----
    inspectGithubBuild: (repoUrl) =>
      apiFetch('/v1/admin/github/inspect', {
        method: 'POST',
        auth: true,
        body: { repoUrl },
      }),

    firmwareUrl: ({ repo, branch, path }) =>
      `${baseUrl}/v1/github/raw?repo=${encodeURIComponent(repo)}&ref=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`,
    async init() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) session = JSON.parse(raw);
      } catch {}
      if (session) {
        const t = await getToken();
        if (t) {
          try {
            const res = await apiFetch('/v1/auth/session', { auth: true });
            admin = res?.isAdmin === true;
          } catch (err) {
              if (err?.status === 401 || err?.status === 403) admin = false;
               else admin = true; // Jangan langsung logout kalau cuma jaringan kedip saat reload
          }
          if (!admin) {
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
      session = await authFetch('/v1/auth/login', { email: String(email).trim(), password });
      admin = true;
      saveSession();
      emit();
      return api.session();
    },

    async signOut() {
      const token = session?.access_token;
      session = null;
      admin = false;
      saveSession();
      emit();
      if (token) {
        fetch(`${baseUrl}/v1/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    },

    // ----- Agregasi Awal (1 request untuk content + projects) -----
    async bootstrap() {
      const res = await apiFetch('/v1/bootstrap');
      return {
        content: normalizeContentUrls(mergeContent(res?.content || {})),
        projects: (res?.projects || []).map(mapProject),
      };
    },

    // ----- Konten Situs -----
    async getContent() {
      const map = await apiFetch('/v1/content');
      return normalizeContentUrls(mergeContent(map || {}));
    },
    async saveContent(k, value) {
      if (!CONTENT_KEYS.includes(k)) throw new Error('Unknown content key');
      await apiFetch(`/v1/admin/content/${encodeURIComponent(k)}`, {
        method: 'PUT',
        auth: true,
        body: { value },
      });
    },

    // ----- Proyek -----
    async listProjects({ all = false } = {}) {
      const rows = all
        ? await apiFetch('/v1/admin/projects', { auth: true })
        : await apiFetch('/v1/projects');
      return (rows || []).map(mapProject);
    },

    async getProject({ slug, id }) {
      try {
        const row = id
          ? await apiFetch(`/v1/admin/projects/${encodeURIComponent(id)}`, { auth: true })
          : await apiFetch(`/v1/projects/${encodeURIComponent(slug)}`);
        return row ? mapProject(row) : null;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },

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
            await uploadBlob(path, img.blob);
            uploaded.push(path);
          }
          images.push({ id: img.id, path, is_cover: !!img.isCover, width: img.width || null, height: img.height || null });
        }

        await apiFetch('/v1/admin/projects', {
          method: 'POST',
          auth: true,
          body: {
            project: {
              id,
              slug: draft.slug,
              title: draft.title,
              short_description: draft.shortDescription,
              full_description: draft.fullDescription,
              status: draft.status,
              image_ratio: draft.imageRatio,
              deploy_config: draft.deployConfig || null,
              images,
              links: draft.links.map((l) => ({ type: l.type, label: l.label || '', url: l.url })),
            },
            removedPaths: draft.removedPaths || [],
          },
        });
      } catch (err) {
        await removeObjects(uploaded);
        if (err.code === '23505') throw new ApiError('That slug is already used by another project.', 409, err.code);
        throw err;
      }
      return id;
    },

    async deleteProject(project) {
      await apiFetch(`/v1/admin/projects/${encodeURIComponent(project.id)}`, {
        method: 'DELETE',
        auth: true,
        body: {
          slug: project.slug,
          imagePaths: project.images.map((i) => i.path),
        },
      });
    },

    // ----- Media Situs -----
    async uploadMedia(blob, folder = 'site') {
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
      return uploadBlob(`${folder}/${uid()}.${ext}`, blob);
    },
    deleteMedia: (paths) => removeObjects(paths),
    mediaUrl,

    // ----- Analitik & Log -----
    async track(evt) {
      await apiFetch('/v1/track', {
        method: 'POST',
        keepalive: true,
        body: evt,
      });
    },

    analytics: ({ days = 30, tz = 'UTC' } = {}) =>
      apiFetch(`/v1/admin/analytics?days=${encodeURIComponent(days)}&tz=${encodeURIComponent(tz)}`, { auth: true }),

    async logs({ limit = 50, before } = {}) {
      const query = `/v1/admin/logs?limit=${encodeURIComponent(limit)}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
      const rows = await apiFetch(query, { auth: true });
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

    async logAuth() {},
  };

  return api;
}
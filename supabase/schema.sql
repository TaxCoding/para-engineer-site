-- =====================================================================
--  PARA ENGINEER — skema Supabase (free tier)
--  Cara pakai: Supabase Dashboard → SQL Editor → New query → tempel
--  SELURUH file ini → Run. Aman dijalankan ulang (idempotent).
--
--  Isi: tabel, Row Level Security, trigger (updated_at + activity log),
--       fungsi simpan-proyek atomik, ringkasan analitik, bucket Storage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ADMIN
--    Hanya user yang terdaftar di tabel ini yang dianggap admin.
--    (Jadi walau seseorang berhasil mendaftar akun, ia TIDAK bisa menulis.)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- sengaja tanpa policy: tabel ini hanya dibaca lewat fungsi is_admin()

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. TABEL
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique
                      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  title             text not null check (char_length(title) between 1 and 120),
  short_description text not null default '' check (char_length(short_description) <= 200),
  full_description  text not null default '' check (char_length(full_description) <= 20000),
  status            text not null default 'draft' check (status in ('published', 'draft', 'archived')),
  image_ratio       text not null default '16:9'  check (image_ratio in ('16:9', '4:3', '1:1')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists projects_status_created_idx on public.projects (status, created_at desc);

create table if not exists public.project_images (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  path       text not null check (char_length(path) <= 300),   -- path di bucket Storage
  sort_order int  not null default 0,
  is_cover   boolean not null default false,                   -- gambar thumbnail
  width      int,
  height     int,
  created_at timestamptz not null default now()
);
create index if not exists project_images_project_idx on public.project_images (project_id, sort_order);

create table if not exists public.project_links (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  type       text not null check (type in ('repository', 'production', 'documentation', 'demo')),
  label      text not null default '' check (char_length(label) <= 60),
  url        text not null check (url ~* '^https?://' and char_length(url) <= 500),
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_links_project_idx on public.project_links (project_id, sort_order);

-- konten Home / About / Social / Contact (key → JSON)
create table if not exists public.site_content (
  key        text primary key check (key in ('site', 'home', 'about', 'socials', 'contact')),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- analitik mandiri: tanpa cookie, tanpa IP
create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type       text not null check (type in ('pageview', 'click')),
  path       text not null check (char_length(path) <= 300),
  project_id uuid references public.projects (id) on delete set null,
  referrer   text check (char_length(referrer) <= 200),
  visitor_id text check (char_length(visitor_id) <= 40),
  session_id text check (char_length(session_id) <= 40),
  device     text check (device in ('mobile', 'tablet', 'desktop')),
  browser    text check (char_length(browser) <= 20),
  label      text check (char_length(label) <= 120),
  target_url text check (char_length(target_url) <= 300)
);
create index if not exists analytics_created_idx      on public.analytics_events (created_at desc);
create index if not exists analytics_type_created_idx on public.analytics_events (type, created_at desc);

-- log aktivitas admin
create table if not exists public.activity_logs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid,
  actor_email text,
  action      text not null,          -- create | update | delete | login | logout
  entity      text not null,          -- project | site | auth
  entity_id   text,
  summary     text not null
);
create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);

-- ---------------------------------------------------------------------
-- 3. TRIGGER: updated_at otomatis
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated on public.projects;
create trigger projects_set_updated before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists site_content_set_updated on public.site_content;
create trigger site_content_set_updated before update on public.site_content
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. TRIGGER: activity log (tidak bisa dipalsukan dari browser)
-- ---------------------------------------------------------------------
create or replace function public.log_project_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action  text := lower(tg_op);
  v_title   text;
  v_id      uuid;
  v_changed text;
  v_summary text;
begin
  if tg_op = 'DELETE' then
    v_title := old.title; v_id := old.id;
    v_summary := format('Deleted project “%s”', v_title);
  elsif tg_op = 'INSERT' then
    v_title := new.title; v_id := new.id;
    v_summary := format('Created project “%s” (%s)', v_title, new.status);
  else
    v_title := new.title; v_id := new.id;
    select string_agg(k, ', ' order by k) into v_changed
      from jsonb_object_keys(to_jsonb(new)) as k
     where k <> 'updated_at' and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k);
    v_summary := format('Updated project “%s”', v_title)
                 || case when coalesce(v_changed, '') <> '' then ' — ' || v_changed else '' end;
  end if;

  insert into public.activity_logs (actor_id, actor_email, action, entity, entity_id, summary)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', 'system'), v_action, 'project', v_id::text, left(v_summary, 300));

  return null;   -- AFTER trigger: nilai kembalian diabaikan
end;
$$;

drop trigger if exists projects_log on public.projects;
create trigger projects_log after insert or update or delete on public.projects
  for each row execute function public.log_project_change();

create or replace function public.log_site_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (actor_id, actor_email, action, entity, entity_id, summary)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', 'system'), lower(tg_op), 'site', new.key,
          format('Updated site content “%s”', new.key));
  return new;
end;
$$;

drop trigger if exists site_content_log on public.site_content;
create trigger site_content_log after insert or update on public.site_content
  for each row execute function public.log_site_change();

-- dipanggil klien untuk peristiwa login / logout
create or replace function public.log_activity(
  p_action    text,
  p_entity    text,
  p_entity_id text default null,
  p_summary   text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.activity_logs (actor_id, actor_email, action, entity, entity_id, summary)
  values (auth.uid(), auth.jwt() ->> 'email', left(p_action, 30), left(p_entity, 30), left(p_entity_id, 60),
          left(coalesce(nullif(p_summary, ''), p_action), 200));
end;
$$;
revoke all on function public.log_activity(text, text, text, text) from public;
grant execute on function public.log_activity(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. SIMPAN PROYEK SECARA ATOMIK (proyek + gambar + tautan dalam 1 transaksi)
--    SECURITY INVOKER → tetap tunduk pada RLS di bawah.
-- ---------------------------------------------------------------------
create or replace function public.save_project(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id   uuid := nullif(p ->> 'id', '')::uuid;
  v_img  jsonb;
  v_link jsonb;
  v_keep uuid[];
  i      int := 0;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if v_id is null then
    v_id := gen_random_uuid();
  end if;

  if exists (select 1 from public.projects where id = v_id) then
    update public.projects
       set slug              = p ->> 'slug',
           title             = p ->> 'title',
           short_description = coalesce(p ->> 'short_description', ''),
           full_description  = coalesce(p ->> 'full_description', ''),
           status            = coalesce(p ->> 'status', 'draft'),
           image_ratio       = coalesce(p ->> 'image_ratio', '16:9')
     where id = v_id;
  else
    insert into public.projects (id, slug, title, short_description, full_description, status, image_ratio)
    values (v_id, p ->> 'slug', p ->> 'title', coalesce(p ->> 'short_description', ''),
            coalesce(p ->> 'full_description', ''), coalesce(p ->> 'status', 'draft'),
            coalesce(p ->> 'image_ratio', '16:9'));
  end if;

  -- gambar: hapus yang tidak ada lagi, upsert sisanya dengan urutan baru
  select coalesce(array_agg((x ->> 'id')::uuid), '{}'::uuid[]) into v_keep
    from jsonb_array_elements(coalesce(p -> 'images', '[]'::jsonb)) as x;
  delete from public.project_images where project_id = v_id and id <> all (v_keep);

  for v_img in select value from jsonb_array_elements(coalesce(p -> 'images', '[]'::jsonb)) loop
    insert into public.project_images (id, project_id, path, sort_order, is_cover, width, height)
    values ((v_img ->> 'id')::uuid, v_id, v_img ->> 'path', i,
            coalesce((v_img ->> 'is_cover')::boolean, false),
            nullif(v_img ->> 'width', '')::int, nullif(v_img ->> 'height', '')::int)
    on conflict (id) do update
       set path = excluded.path, sort_order = excluded.sort_order, is_cover = excluded.is_cover,
           width = excluded.width, height = excluded.height
     where public.project_images.project_id = v_id;
    i := i + 1;
  end loop;

  -- tautan: ganti seluruhnya
  delete from public.project_links where project_id = v_id;
  i := 0;
  for v_link in select value from jsonb_array_elements(coalesce(p -> 'links', '[]'::jsonb)) loop
    insert into public.project_links (project_id, type, label, url, sort_order)
    values (v_id, v_link ->> 'type', coalesce(v_link ->> 'label', ''), v_link ->> 'url', i);
    i := i + 1;
  end loop;

  return v_id;
end;
$$;
revoke all on function public.save_project(jsonb) from public;
grant execute on function public.save_project(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 6. RINGKASAN ANALITIK (hanya admin) — dihitung di server agar ringan
-- ---------------------------------------------------------------------
create or replace function public.analytics_summary(p_days int default 30, p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days  int  := least(greatest(coalesce(p_days, 30), 1), 365);
  v_tz    text := coalesce(p_tz, 'UTC');
  v_to    date;
  v_from  date;
  v_start timestamptz;
  r       jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  begin
    perform now() at time zone v_tz;
  exception when others then
    v_tz := 'UTC';
  end;

  v_to    := (now() at time zone v_tz)::date;
  v_from  := v_to - (v_days - 1);
  v_start := ((v_from - v_days)::timestamp) at time zone v_tz;   -- awal periode sebelumnya

  with ev as (
    select e.*, (e.created_at at time zone v_tz)::date as d
      from public.analytics_events e
     where e.created_at >= v_start
  ),
  cur as (select * from ev where d >= v_from),
  prv as (select * from ev where d <  v_from)
  select jsonb_build_object(
    'days', v_days,
    'totals', jsonb_build_object(
      'views',    (select count(*) from cur where type = 'pageview'),
      'visitors', (select count(distinct visitor_id) from cur where type = 'pageview'),
      'sessions', (select count(distinct session_id) from cur where type = 'pageview'),
      'clicks',   (select count(*) from cur where type = 'click')
    ),
    'prev', jsonb_build_object(
      'views',    (select count(*) from prv where type = 'pageview'),
      'visitors', (select count(distinct visitor_id) from prv where type = 'pageview')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', to_char(g.d, 'YYYY-MM-DD'),
               'views', coalesce(x.views, 0),
               'visitors', coalesce(x.visitors, 0)) order by g.d), '[]'::jsonb)
        from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') as g(d)
        left join (
          select d, count(*) as views, count(distinct visitor_id) as visitors
            from cur where type = 'pageview' group by d
        ) x on x.d = g.d::date
    ),
    'pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', t.path, 'views', t.c) order by t.c desc), '[]'::jsonb)
        from (select path, count(*) as c from cur where type = 'pageview' group by path order by c desc limit 8) t
    ),
    'projects', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.project_id, 'title', coalesce(pr.title, 'Deleted project'), 'slug', coalesce(pr.slug, ''),
               'views', t.views, 'clicks', t.clicks) order by t.views desc), '[]'::jsonb)
        from (
          select project_id,
                 count(*) filter (where type = 'pageview') as views,
                 count(*) filter (where type = 'click')    as clicks
            from cur where project_id is not null
           group by project_id order by 2 desc limit 6
        ) t
        left join public.projects pr on pr.id = t.project_id
    ),
    'referrers', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.n, 'count', t.c) order by t.c desc), '[]'::jsonb)
        from (select coalesce(referrer, 'Direct') as n, count(*) as c from cur where type = 'pageview'
               group by 1 order by 2 desc limit 6) t
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.n, 'count', t.c) order by t.c desc), '[]'::jsonb)
        from (select coalesce(device, 'desktop') as n, count(*) as c from cur where type = 'pageview'
               group by 1 order by 2 desc limit 4) t
    ),
    'browsers', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.n, 'count', t.c) order by t.c desc), '[]'::jsonb)
        from (select coalesce(browser, 'Other') as n, count(*) as c from cur where type = 'pageview'
               group by 1 order by 2 desc limit 5) t
    ),
    'clicks', (
      select coalesce(jsonb_agg(jsonb_build_object('label', t.n, 'count', t.c) order by t.c desc), '[]'::jsonb)
        from (select coalesce(label, 'Link') as n, count(*) as c from cur where type = 'click'
               group by 1 order by 2 desc limit 8) t
    )
  ) into r;

  return r;
end;
$$;
revoke all on function public.analytics_summary(int, text) from public;
grant execute on function public.analytics_summary(int, text) to authenticated;

-- (opsional) bersihkan data analitik lama agar free tier tetap ringan:
--   select public.purge_old_analytics(400);
create or replace function public.purge_old_analytics(p_days int default 400)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  delete from public.analytics_events where created_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_analytics(int) from public;
grant execute on function public.purge_old_analytics(int) to authenticated;

-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.projects         enable row level security;
alter table public.project_images   enable row level security;
alter table public.project_links    enable row level security;
alter table public.site_content     enable row level security;
alter table public.analytics_events enable row level security;
alter table public.activity_logs    enable row level security;

-- hak akses tabel minimum (RLS tetap menjadi penjaga utama)
revoke all on public.projects, public.project_images, public.project_links,
              public.site_content, public.analytics_events, public.activity_logs
  from anon, authenticated;

grant select on public.projects, public.project_images, public.project_links, public.site_content
  to anon, authenticated;
grant insert, update, delete on public.projects, public.project_images, public.project_links
  to authenticated;
grant insert, update on public.site_content to authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant select on public.activity_logs to authenticated;

-- projects: publik hanya melihat yang published; admin semuanya
drop policy if exists projects_public_read on public.projects;
create policy projects_public_read on public.projects
  for select to anon, authenticated using (status = 'published');
drop policy if exists projects_admin_all on public.projects;
create policy projects_admin_all on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- project_images / project_links: ikut status proyek induknya
drop policy if exists images_public_read on public.project_images;
create policy images_public_read on public.project_images
  for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.status = 'published'));
drop policy if exists images_admin_all on public.project_images;
create policy images_admin_all on public.project_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists links_public_read on public.project_links;
create policy links_public_read on public.project_links
  for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.status = 'published'));
drop policy if exists links_admin_all on public.project_links;
create policy links_admin_all on public.project_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- site_content: dibaca semua orang, ditulis admin
drop policy if exists site_public_read on public.site_content;
create policy site_public_read on public.site_content
  for select to anon, authenticated using (true);
drop policy if exists site_admin_write on public.site_content;
create policy site_admin_write on public.site_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- analytics: siapa pun boleh MENAMBAH event (dibatasi constraint), tak ada yang boleh membaca
-- langsung — admin membaca lewat analytics_summary()
drop policy if exists analytics_insert on public.analytics_events;
create policy analytics_insert on public.analytics_events
  for insert to anon, authenticated with check (true);

-- activity log: hanya admin yang membaca; penulisan hanya lewat trigger / log_activity()
drop policy if exists logs_admin_read on public.activity_logs;
create policy logs_admin_read on public.activity_logs
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8. STORAGE: bucket publik "media" (hanya admin yang boleh menulis)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880,
        array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif'])
on conflict (id) do update
   set public = excluded.public,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_admin_select on storage.objects;
create policy media_admin_select on storage.objects
  for select to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_insert on storage.objects;
create policy media_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_update on storage.objects;
create policy media_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_delete on storage.objects;
create policy media_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------------
-- 9. JADIKAN AKUNMU ADMIN  (jalankan SETELAH membuat user di Authentication → Users)
--    Ganti email, hapus tanda "--" di depan, lalu Run:
-- ---------------------------------------------------------------------
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'GANTI-DENGAN-EMAILMU@example.com'
-- on conflict do nothing;

# para.engineer

Situs portofolio dengan tema putih bersih + kucing elastis, panel admin lengkap, dan analitik mandiri.
**Tanpa build step, tanpa npm** — HTML/CSS/JS murni (ES modules) + Supabase (free tier) + Vercel.

## Fitur

**Publik** — Home (hero kucing) → Projects → Social media → About. Halaman detail proyek: galeri gambar,
judul, deskripsi lengkap, tautan (Repository / Production / Documentation / Demo), created & updated at,
ajakan kontak, dan proyek lain sebagai saran.

**Admin** (`/admin`) — login dengan kucing di atas kartu → otomatis ke dashboard.
Dashboard & analitik (grafik, top pages, referrer, perangkat, klik tautan), log aktivitas,
editor Home / About / Contact & Social, dan manajemen proyek: multi-upload, crop (16:9 · 4:3 · 1:1),
pilih cover, urutkan galeri, ganti/hapus gambar, banyak tautan per proyek, switch production,
status published / draft / archived.

## Coba sekarang (Mode Demo)

```bash
node dev.js        # lalu buka http://localhost:3000
```

Selama `js/config.js` belum diisi, situs berjalan di **mode demo** (data tersimpan di browser saja).
Login demo: `admin@para.engineer` / `demo`. Reset data demo: hapus `pe_demo_db_v1` di localStorage.

## Pasang Supabase (±10 menit)

1. Buat proyek di [supabase.com](https://supabase.com) (free tier cukup).
2. **Authentication → Users → Add user** → isi emailmu + password → centang *Auto Confirm User*.
3. **Authentication → Sign In / Providers → Email** → matikan **Allow new users to sign up**
   (agar tak ada orang lain bisa membuat akun).
4. **SQL Editor** → New query → tempel seluruh isi `supabase/schema.sql` → **Run**.
5. Di SQL Editor jalankan (ganti email) agar akunmu jadi admin:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'emailmu@example.com'
   on conflict do nothing;
   ```
6. **Project Settings → API** → salin *Project URL* dan *anon / publishable key* ke `js/config.js`.
   (Jangan pernah memakai `service_role` key di sini.)
7. Commit & deploy.

> Key `anon` memang publik. Yang melindungi data adalah Row Level Security di `schema.sql`:
> publik hanya bisa membaca proyek `published`; menulis/mengunggah hanya untuk akun di tabel `admins`.

## Deploy ke Vercel

1. Push folder ini ke GitHub (repo `para.engineer`).
2. Vercel → *Add New Project* → pilih repo. Framework: **Other**, tanpa build command, output dir kosong/root.
3. Tambahkan domain `www.para.engineer` di *Settings → Domains*.

`vercel.json` sudah berisi rewrite SPA, header keamanan, dan CSP yang mengizinkan `*.supabase.co`.

## API key yang dibutuhkan

Hanya **dua nilai**, keduanya dari Supabase: `Project URL` dan `anon key`. Tidak ada layanan berbayar lain:

| Kebutuhan | Solusi (gratis) |
|---|---|
| Database, login, penyimpanan gambar | Supabase free tier |
| Analitik | Dibuat sendiri (tanpa cookie & IP) — tersimpan di tabel `analytics_events` |
| Log aktivitas | Trigger database → tabel `activity_logs` |
| Hosting | Vercel Hobby |

Tips free tier: gambar otomatis di-crop & dikompres ke WebP ≤1600px sebelum diunggah. Data analitik lama bisa
dibersihkan dengan `select public.purge_old_analytics(400);` (menghapus data > 400 hari).

## Struktur

```
index.html · style.css          tema asli (token warna, sidebar, kucing, drawer)
css/pages.css · css/admin.css   halaman publik & admin
js/main.js                      router & rute
js/config.js                    isi URL + anon key Supabase
js/data/                        supabase.js (live) · demo.js (mode demo) · api.js · defaults.js
js/lib/                         router, util, ikon, kucing, tracking, kartu
js/pages/                       home, project (publik)
js/admin/                       login, dashboard, analytics, logs, projects, editor, cropper, content
supabase/schema.sql             tabel, RLS, trigger, RPC, bucket Storage
```

## Catatan

- Fitur chat Gemini dari tema lama (`api/chat.js`) **tidak** disertakan. Bisa ditambahkan terpisah sebagai
  Vercel Function bila diinginkan (butuh Gemini API key di environment variable, bukan di `config.js`).
- `assets/cat-2.png` berukuran ±1.6 MB; kompres bila ingin halaman awal lebih ringan.
- Analitik tidak mencatat admin, bot, dan `localhost` (ubah `trackLocalhost` untuk menguji).

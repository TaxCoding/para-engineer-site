# Para Engineer

Situs portofolio dan proyek karya Raja Naufal Zhahir dengan tampilan putih bersih, ilustrasi kucing interaktif, panel admin, dan analitik mandiri.

**Tanpa build step dan tanpa npm:** aplikasi ini dibangun sepenuhnya dengan HTML, CSS, JavaScript ES modules, Supabase, dan Vercel.

## Daftar Isi

- [Ringkasan](#ringkasan)
- [Fitur](#fitur)
- [Alur Halaman dan Rute](#alur-halaman-dan-rute)
- [Teknologi](#teknologi)
- [Persyaratan](#persyaratan)
- [Menjalankan Secara Lokal](#menjalankan-secara-lokal)
- [Mode Demo](#mode-demo)
- [Konfigurasi Situs](#konfigurasi-situs)
- [Menghubungkan Supabase](#menghubungkan-supabase)
- [Skema Supabase](#skema-supabase)
- [Deployment ke Vercel](#deployment-ke-vercel)
- [Panel Admin](#panel-admin)
- [Analitik dan Privasi](#analitik-dan-privasi)
- [Struktur Proyek](#struktur-proyek)
- [Pemeliharaan](#pemeliharaan)
- [Keamanan](#keamanan)
- [Troubleshooting](#troubleshooting)
- [Lisensi](#lisensi)

## Ringkasan

Para Engineer adalah situs portfolio SPA dengan dua backend yang dapat dipilih:

1. **Mode demo** — menyimpan konten, proyek, sesi login admin, dan riwayat perubahan di `localStorage`. Tidak memerlukan akun Supabase.
2. **Mode Supabase** — memakai Autentikasi, Database, Storage, Row Level Security, RPC, dan trigger milik Supabase.

Pemilihan backend dilakukan secara otomatis di `js/data/api.js`: ketika URL dan anon/publishable key Supabase di `js/config.js` kosong, aplikasi memakai demo. Jika keduanya terisi, aplikasi memakai Supabase.

## Fitur

### Situs publik

- Beranda dengan hero kucing interaktif, suara, navigasi seksi, dan CTA.
- Showcase proyek otomatis dengan kontrol jeda, sebelumnya, dan berikutnya.
- Daftar seluruh proyek berstatus `published`.
- Halaman detail proyek dengan:
  - judul dan deskripsi singkat;
  - deskripsi lengkap dengan format teks rich;
  - galeri gambar responsif dan lightbox;
  - rasio tampilan `16:9`, `4:3`, atau `1:1`;
  - tautan `Repository`, `Production`, `Documentation`, dan `Demo`;
  - tanggal dibuat dan diperbarui;
  - CTA email dan media sosial;
  - rekomendasi proyek acak.
- Metadata SEO, Open Graph, canonical URL, dan JSON-LD dasar.
- Navigasi desktop/mobile, gambar aset lokal, dan tampilan responsif.
- Halaman `404` untuk slug atau rute yang tidak ditemukan.

### Panel admin

Panel tersedia di `/admin` dan dilindungi oleh pemeriksaan status admin.

- Login dengan email dan password lewat Supabase Auth.
- Dashboard ringkasan proyek dan navigasi cepat.
- Analitik mandiri:
  - tampilan halaman;
  - pengunjung dan sesi unik;
  - klik tautan;
  - tren harian;
  - halaman teratas;
  - proyek teratas;
  - perujuk;
  - perangkat;
  - browser.
- Log aktivitas login, logout, pembuatan, pembaruan, dan penghapusan.
- Editor konten:
  - identitas situs;
  - beranda;
  - profil dan keahlian;
  - media sosial;
  - kontak.
- Manajemen proyek:
  - buat, ubah, dan hapus proyek;
  - status `published`, `draft`, atau `archived`;
  - deskripsi singkat dan deskripsi lengkap;
  - banyak tautan dengan label khusus;
  - multi-upload gambar;
  - pemotongan gambar menjadi rasio `16:9`, `4:3`, atau `1:1`;
  - kompresi dan konversi ke WebP;
  - pilih cover;
  - ubah urutan galeri;
  - hapus atau ganti gambar;
  - pratinjau proyek draft/archived.

## Alur Halaman dan Rute

| Rute | Akses | Keterangan |
|---|---|---|
| `/` | Publik | Beranda, proyek unggulan, About, dan Contact |
| `/projects/:slug` | Publik untuk proyek published | Halaman detail proyek |
| `/404` | Publik | Halaman tidak ditemukan |
| `/admin` | Publik sebelum login | Login admin; otomatis ke dashboard jika sudah login |
| `/admin/dashboard` | Admin | Ringkasan admin |
| `/admin/analytics` | Admin | Ringkasan dan grafik analitik |
| `/admin/logs` | Admin | Log aktivitas |
| `/admin/projects` | Admin | Daftar semua proyek |
| `/admin/projects/new` | Admin | Membuat proyek |
| `/admin/projects/:id` | Admin | Mengubah proyek |
| `/admin/home` | Admin | Mengubah konten beranda |
| `/admin/about` | Admin | Mengubah profil dan keahlian |
| `/admin/contact` | Admin | Mengubah konten kontak dan media sosial |

Rute yang tidak dikenali fallback ke `/404`. Hanya proyek berstatus `published` yang terlihat oleh pengunjung melalui REST API publik.

## Teknologi

- **Frontend:** HTML5, CSS3, JavaScript ES modules.
- **Routing:** History API dan router ringan buatan sendiri.
- **Backend:** Supabase REST/PostgREST, GoTrue Auth, dan Storage.
- **Database:** PostgreSQL melalui Supabase.
- **Keamanan:** Supabase Row Level Security (RLS).
- **Analitik:** tabel event dan fungsi ringkasan PostgreSQL tanpa cookie pihak ketiga.
- **Hosting:** Vercel atau server HTTP statis apa pun yang mendukung SPA fallback.
- **Local development:** `dev.js`, server Node.js bawaan tanpa package/dependency.

Tidak ada framework frontend, bundler, package manager, API key CDN, atau build output yang wajib dipasang.

## Persyaratan

- Browser modern yang mendukung ES modules.
- Node.js hanya untuk menjalankan server lokal `dev.js`. Node.js tidak diperlukan untuk mengedit atau men-deploy file statis.
- Proyek Supabase hanya apabila aplikasi akan memakai mode produksi.
- Akun Vercel hanya apabila akan di-deploy ke Vercel.

## Menjalankan Secara Lokal

Jalankan dari direktori repository:

```bash
node dev.js
```

Buka:

```text
http://localhost:3000
```

Port dapat diganti:

```bash
PORT=4173 node dev.js
```

Server menolak traversal direktori, mengembalikan `404` untuk aset yang tidak ditemukan, dan mengarahkan rute SPA tanpa ekstensi ke `index.html`.

Alternatif tanpa Node, gunakan server statis apa pun yang mendukung fallback ke `index.html`.

## Mode Demo

Mode demo aktif jika `supabaseUrl` dan `supabaseAnonKey` di `js/config.js` keduanya kosong.

Data demo tersimpan pada browser:

- database demo: `pe_demo_db_v1`;
- sesi demo: `pe_demo_session_v1`;
- sesi/visitor analitik: `pe_vid` dan `pe_sid`.

Login demo bawaan:

```text
Email: admin@para.engineer
Password: demo
```

Mode demo menyediakan proyek contoh, gambar SVG, analitik sintetis, serta log dan konten yang dapat diubah. Data tidak akan muncul pada perangkat/browser lain dan dapat hilang jika penyimpanan situs dibersihkan.

Reset seluruh data demo:

1. Buka Developer Tools.
2. Buka tab Application atau Storage.
3. Hapus `pe_demo_db_v1`.
4. Muat ulang halaman.

Untuk logout demo, gunakan tombol Sign out pada panel admin.

## Konfigurasi Situs

Konfigurasi utama ada di `js/config.js`:

```js
export const config = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  bucket: 'media',
  siteUrl: 'https://www.para.engineer',
  trackLocalhost: false
};
```

| Nilai | Fungsi |
|---|---|
| `supabaseUrl` | Project URL dari Supabase, misalnya `https://abcdxyz.supabase.co` |
| `supabaseAnonKey` | Publishable key atau anon key dari Supabase |
| `bucket` | Nama bucket Storage untuk gambar proyek |
| `siteUrl` | Domain kanonis situs untuk metadata Open Graph dan canonical URL |
| `trackLocalhost` | Aktifkan pencatatan kunjungan dari localhost |

Gunakan `anon`/publishable key, bukan `service_role` key. Supabase publishable key memang dirancang untuk browser dan aman dipublikasikan hanya jika RLS diterapkan dengan benar.

Konten default situs berada di `js/data/defaults.js` dan dapat ditimpa melalui editor admin. Kunci konten yang tersedia adalah `site`, `home`, `about`, `socials`, dan `contact`.

## Menghubungkan Supabase

### 1. Buat proyek

1. Buat proyek baru di Supabase.
2. Simpan password database dan kelola koneksinya melalui Dashboard atau SQL Editor.

### 2. Matikan signup publik

1. Buka **Authentication → Providers → Email**.
2. Matikan **Allow new users to sign up**.
3. Buat akun admin melalui **Authentication → Users → Add user**.
4. Aktifkan **Auto Confirm User** saat membuat akun agar tidak memerlukan verifikasi email.

### 3. Jalankan skema database

1. Buka **SQL Editor**.
2. Buat query baru.
3. Tempel seluruh isi `supabase/schema.sql`.
4. Jalankan query.

Skema dibuat idempoten dengan `create table if not exists`, `drop policy if exists`, dan pembaruan fungsi yang aman dijalankan ulang.

### 4. Jadikan akun sebagai admin

Ganti email pada SQL berikut lalu jalankan:

```sql
insert into public.admins (user_id)
select id
from auth.users
where email = 'emailmu@example.com'
on conflict do nothing;
```

Admin ditentukan melalui tabel `admins`. Akun Supabase biasa yang berhasil diautentikasi tidak otomatis mendapat izin menulis.

### 5. Isi konfigurasi frontend

Buka **Project Settings → API** dan salin:

- Project URL ke `supabaseUrl`;
- anon/publishable key ke `supabaseAnonKey`.

Contoh isian:

```js
export const config = {
  supabaseUrl: 'https://abcdxyz.supabase.co',
  supabaseAnonKey: 'publishable-key-panjang',
  bucket: 'media',
  siteUrl: 'https://www.para.engineer',
  trackLocalhost: false
};
```

Jangan isi field konfigurasi dengan `service_role key`.

## Skema Supabase

File `supabase/schema.sql` mencakup seluruh database yang dibutuhkan.

### Tabel utama

| Tabel | Fungsi |
|---|---|
| `admins` | Pemetaan user Supabase yang memiliki izin admin |
| `projects` | Judul, slug, deskripsi, status, rasio gambar, dan timestamp |
| `project_images` | Galeri gambar, urutan, cover, lebar, dan tinggi |
| `project_links` | Tautan repository, production, documentation, atau demo |
| `site_content` | Konten situs dalam JSON untuk `site`, `home`, `about`, `socials`, dan `contact` |
| `analytics_events` | Event pageview dan click |
| `activity_logs` | Riwayat aksi admin |

### Fungsi dan trigger

- `is_admin()` memeriksa apakah `auth.uid()` terdaftar di tabel `admins`.
- Trigger proyek memperbarui `updated_at` secara otomatis.
- Trigger perubahan proyek dan konten membuat catatan `activity_logs`.
- `log_activity()` mencatat aksi login dan logout.
- `save_project(p jsonb)` menyimpan proyek, gambar, dan tautan dalam satu transaksi atomik.
- `analytics_summary(p_days, p_tz)` menghitung ringkasan analitik yang hanya dapat diakses admin.
- `purge_old_analytics(p_days)` menghapus event analitik lama dan membatasi periode minimum 30 hari.

### Row Level Security

Policy RLS melindungi:

- pengunjung hanya dapat membaca proyek `published`;
- semua admin dapat membaca dan mengubah proyek serta konten;
- pengunjung dapat memasukkan event analitik tetapi tidak dapat membacanya langsung;
- log aktivitas hanya dapat dibaca oleh admin;
- bucket `media` hanya dapat ditulis oleh admin.

### Storage

Skema membuat bucket publik `media` dengan:

- batas ukuran file 5 MB;
- format yang diizinkan: WebP, JPEG, PNG, GIF, dan AVIF.

Gambar tetap dapat dibaca publik melalui URL object, sementara operasi upload, update, dan delete dibatasi untuk admin.

## Deployment ke Vercel

1. Push repository ke GitHub.
2. Di Vercel pilih **Add New Project**.
3. Pilih repository ini.
4. Gunakan pengaturan:
   - Framework Preset: **Other**;
   - Build Command: kosong;
   - Output Directory: kosong atau `.`;
   - Install Command: kosong.
5. Tambahkan domain yang diinginkan pada **Settings → Domains**.
6. Deploy.

`vercel.json` sudah berisi:

- SPA rewrite untuk semua rute non-file;
- penghapusan trailing slash;
- header keamanan;
- CSP yang mengizinkan script/style lokal serta koneksi dan gambar dari `*.supabase.co`;
- cache singkat untuk HTML/JS/CSS;
- cache 30 hari untuk folder `assets`.

Jangan menaruh environment Supabase sebagai rahasia dalam Vercel jika menggunakan implementasi frontend murni ini; `supabaseUrl` dan publishable key memang dipakai oleh browser.

## Panel Admin

### Login

Buka `/admin`, lalu gunakan akun yang telah dimasukkan ke tabel `admins`.

Menu rahasia kucing pada beranda juga mengarah ke `/admin`, tetapi bukan mekanisme autentikasi; izin tetap ditentukan oleh sesi Supabase dan RLS.

### Editor proyek

Saat menyimpan proyek:

1. Gambar baru dikompresi dan diubah menjadi WebP bila dibutuhkan.
2. Gambar ditempatkan pada path Storage berdasarkan ID proyek.
3. Metadata proyek disimpan melalui RPC `save_project`.
4. Gambar yang tidak lagi dipakai dapat dihapus dari Storage.
5. Status draft tidak muncul di daftar publik dan tampil sebagai pratinjau hanya saat admin login.

Pastikan slug hanya memakai huruf kecil, angka, dan tanda hubung tunggal, misalnya `smart-garden-v2`.

### Pengelolaan konten

Editor `Home`, `About`, dan `Contact` menyimpan data JSON ke tabel `site_content`. Nilai yang tidak diisi akan otomatis digabung dengan konten default, sehingga situs tidak berhenti bila salah satu field belum tersedia.

## Analitik dan Privasi

Analitik dibuat sendiri dan tidak memakai Google Analytics, cookie pihak ketiga, atau penyimpanan alamat IP.

Event yang disimpan berisi:

- tipe event;
- path halaman;
- ID proyek opsional;
- host perujuk eksternal;
- ID visitor acak;
- ID sesi acak;
- tipe perangkat;
- browser kasar;
- label dan target URL untuk klik.

Pembatasan pencatatan:

- kunjungan admin tidak dicatat;
- bot/crawler diblokir pada mode Supabase;
- localhost tidak dicatat kecuali `trackLocalhost` aktif;
- pageview yang sama tidak dicatat dua kali berturut-turut;
- mode demo hanya menghasilkan data sintetis dan tidak mengirim event ke Supabase.

Untuk menghapus event lama secara manual:

```sql
select public.purge_old_analytics(400);
```

Nilai parameter adalah jumlah hari minimum yang dipertahankan.

## Struktur Proyek

```text
.
|-- index.html                  Kerangka HTML, shell, header, drawer, dan modal
|-- style.css                   Token tema, layout global, sidebar, kucing, dan drawer
|-- css/
|   |-- pages.css               Gaya halaman publik
|   `-- admin.css               Gaya dashboard dan panel admin
|-- js/
|   |-- main.js                 Registrasi rute dan bootstrap aplikasi
|   |-- config.js               Konfigurasi Supabase, domain, Storage, dan localhost
|   |-- data/
|   |   |-- api.js              Pemilih backend dan cache singkat
|   |   |-- supabase.js         Klien REST/Auth/Storage Supabase tanpa library
|   |   |-- demo.js             Backend demo berbasis localStorage
|   |   `-- defaults.js         Konten default, rasio, dan status
|   |-- lib/
|   |   |-- router.js           SPA routing dan transisi
|   |   |-- shell.js            Header, sidebar, drawer, dan navigasi
|   |   |-- track.js            Pageview dan tracking klik
|   |   |-- cards.js            Kartu dan status proyek
|   |   |-- cats.js             Interaksi kucing
|   |   |-- icons.js            Pemetaan ikon
|   |   `-- util.js             Helper format, escape, dan metadata
|   |-- pages/
|   |   |-- home.js             Beranda publik
|   |   `-- project.js          Detail proyek, galeri, dan lightbox
|   `-- admin/
|       |-- login.js            Login admin
|       |-- dashboard.js        Dashboard
|       |-- analytics.js        Tampilan analitik
|       |-- logs.js             Log aktivitas
|       |-- projects.js         Daftar manajemen proyek
|       |-- editor.js           Editor dan crop/upload proyek
|       |-- content.js          Editor konten situs
|       |-- shared.js           Helper bersama admin
|       |-- chart.js            Rendering grafik
|       |-- cropper.js          Pemotongan gambar
|       `-- ui.js               Komponen UI admin
|-- assets/                     Gambar kucing dan efek suara
|-- supabase/
|   `-- schema.sql              Tabel, RLS, trigger, RPC, dan Storage
|-- dev.js                      Server lokal Node.js tanpa dependency
|-- vercel.json                 Rewrite, CSP, header, dan cache
`-- README.md
```

## Pemeliharaan

- Jalankan skema SQL ulang setelah memperbarui `supabase/schema.sql`; skema dirancang aman dijalankan ulang.
- Backup database dan bucket Storage secara berkala.
- Gunakan kapasitas free tier secara bijak dengan mempurge event analitik lama.
- Gambar dikompresi dan dikonversi ke WebP sebelum diunggah, dengan batas tampilan maksimum 1600 px.
- Periksa dan hapus object Storage milik proyek yang sudah tidak digunakan.
- Pertahankan format slug agar URL lama tidak pecah.
- Jangan mengganti domain `siteUrl` sebelum memperbarui metadata dan canonical URL.
- Uji halaman publik, login admin, editor, upload, dan rute detail setelah setiap perubahan schema.

## Keamanan

- Tidak memasukkan `service_role` key ke frontend atau repository.
- Jangan menaruh environment variable rahasia pada CSS/JavaScript publik.
- Matikan signup publik agar hanya admin yang dibuat melalui Dashboard dapat masuk.
- Gunakan tabel `admins` sebagai allowlist admin tambahan selain RLS.
- RLS tetap menjadi lapisan pertahanan meski publishable key sudah diketahui publik.
- Header CSP, `X-Frame-Options`, dan `nosniff` sudah dikonfigurasi di `vercel.json`.
- Semua output konten teks memakai escaping pada renderer publik.
- URL tautan proyek harus memakai `http://` atau `https://`.

## Troubleshooting

### Situs tetap masuk mode demo

Pastikan `supabaseUrl` dan `supabaseAnonKey` sudah terisi. Konfigurasi dianggap belum tersedia jika salah satu string kosong.

### Login berhasil tetapi ditolak sebagai admin

Pastikan email akun ada pada tabel `admins`:

```sql
select *
from public.admins
join auth.users on auth.users.id = public.admins.user_id;
```

Kemudian jalankan kembali SQL pemberian role admin untuk akun tersebut.

### Data atau gambar tidak muncul

- Jalankan ulang `supabase/schema.sql`.
- Pastikan policy RLS sudah terbentuk.
- Pastikan proyek berstatus `published`.
- Pastikan bucket bernama `media` atau sesuaikan `config.bucket`.
- Periksa Console dan Network untuk error REST/Storage.

### Upload gambar gagal

Periksa:

- file masih di bawah 5 MB;
- MIME berupa WebP, JPEG, PNG, GIF, atau AVIF;
- akun login benar-benar terdaftar sebagai admin;
- policy `media_admin_insert` aktif pada bucket Storage.

### Rute admin atau proyek menampilkan 404 di server lokal

Gunakan `node dev.js`, bukan membuka `index.html` langsung lewat `file://`. Perlu juga server yang mengarahkan rute SPA tanpa ekstensi ke `index.html`.

### Pustaka atau build npm tidak ditemukan

Aplikasi tidak memakai npm. Jalankan `node dev.js` untuk server lokal atau gunakan server statis/Vercel.

## Lisensi

Lisensi situs mengikuti nilai konten default pada `js/data/defaults.js`: MIT License.

Pembaca wajib memeriksa lisensi aset kucing, ikon, audio, dan repository turunan sebelum digunakan ulang atau didistribusikan.

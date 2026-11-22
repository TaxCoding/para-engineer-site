// ============================================================
// KONFIGURASI — isi dua nilai Supabase di bawah, lalu deploy.
//
// Keduanya BOLEH publik (memang dipakai di browser). Keamanan data
// dijaga oleh Row Level Security di supabase/schema.sql, BUKAN oleh
// kerahasiaan key ini. JANGAN PERNAH menaruh "service_role" key di sini.
//
// Dibiarkan kosong  → situs berjalan di MODE DEMO (data hanya di browser
//                      kamu, login demo: admin@para.engineer / demo).
// ============================================================
export const config = {
  supabaseUrl: 'https://vwpfzqjiubyopasynvog.supabase.co',      // contoh: https://abcdxyz.supabase.co
  supabaseAnonKey: 'sb_publishable_g4THP8TMUpSuFk4vnE5Sfg_tLw9SwI3',  // Project Settings → API → anon / publishable key
  bucket: 'media',      // nama bucket Storage (dibuat oleh schema.sql)
  siteUrl: 'https://www.para.engineer',
  trackLocalhost: false // true = catat kunjungan saat development
};

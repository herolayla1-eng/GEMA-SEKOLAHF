# GEMA — Setup Server + Database Kode (Vercel KV)

## 1. Yang kamu dapat

| Path | Fungsi |
|------|--------|
| `/api/activate` | Aktivasi kode + ikat 1 device |
| `/api/quota` | Cek & potong kuota soal/chat harian |
| `/api/admin` | Admin: buat kode, nonaktifkan, ganti device |
| `/admin` | Halaman admin (password) |

## 2. Pasang Vercel KV (database)

1. Buka [Vercel Dashboard](https://vercel.com) → project GEMA
2. **Storage** → **Create Database** → **KV (Redis)**
3. Hubungkan ke project yang sama
4. Vercel akan mengisi env:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

## 3. Password admin

Di Vercel → Project → **Settings** → **Environment Variables**:

| Name | Value |
|------|--------|
| `ADMIN_PASSWORD` | password rahasia kamu (jangan mudah) |

Redeploy setelah menambah env.

## 4. Deploy

Upload folder `gema-sekolah` (termasuk `api/`, `lib/`, `package.json`, `admin.html`).

Vercel otomatis `npm install` karena ada `package.json`.

## 5. Uji cepat

1. Buka `https://YOUR-APP.vercel.app/admin`
2. Login dengan `ADMIN_PASSWORD`
3. Buat kode mis. `SULTAN-TEST01` tier Sultan
4. Buka app user → aktivasi kode itu di HP

## 6. Kuota (setelah server hidup)

| Tier | Soal/hari | Chat/hari |
|------|-----------|-----------|
| Lite | 10 | 5 menit |
| Sultan | 100 | 30 menit |
| Raja Pro | 500 | 90 menit |

Reset tiap **00:00 WIB**.

Raja Pro: ganti device **1×** lewat tombol di admin (bukan 2 HP bareng).


## 7. Production — kode demo dimatikan

Di domain Vercel (bukan localhost):

- `LITE-DEMO` / `SULTAN-DEMO` / `RAJA-DEMO` **tidak bisa** dipakai
- Hanya kode yang dibuat di `/admin` + tersimpan di KV

Localhost tetap bisa pakai kode demo untuk testing.

TALENTHUB - KOL RATECARD FINDER

Platform web internal full-stack monolith yang dirancang khusus 
untuk mencari, menyaring, dan mengelola data ratecard Influencer 
/ KOL (Key Opinion Leader) secara efisien.

FITUR UTAMA
* KOL Search & Filter: 
  Mempermudah pencarian Influencer berdasarkan nama, platform 
  (Instagram/TikTok), jumlah followers, kategori niche, dan 
  rentang harga ratecard.
* Ratecard Management (CRUD): 
  Fitur untuk menambah, mengubah, dan menghapus database 
  ratecard KOL terbaru ke dalam sistem.
* Single User Authentication: 
  Sistem login terpusat menggunakan next-auth di mana hak akses 
  hanya diberikan kepada 1 User Utama (ADMIN) untuk menjaga 
  keamanan data internal perusahaan.

TECH STACK & ARSITEKTUR
* Frontend: Next.js (App Router), React, TypeScript.
* Styling: Tailwind CSS.
* Backend & Database: Node.js (Next API Routes), PostgreSQL, Prisma ORM.
* Security: NextAuth.js (Credentials Provider).

PERSIAPAN ENVIRONMENT (.env)
Buat file .env di root project dan isi konfigurasinya seperti ini:

DATABASE_URL="postgresql://postgres:password@localhost:5432/talenthub_ratecard"
AUTH_SECRET="isi-dengan-string-random-bebas"

LANGKAH JALANKAN APLIKASI DI LAPTOP TIM
Buka Terminal di VS Code, lalu jalankan perintah ini secara berurutan:
1. Install semua library pendukung:
   npm install
2. Sinkronisasi struktur tabel ratecard ke PostgreSQL lokal:
   npx prisma migrate dev --name init_talenthub
3. Jalankan server lokal untuk mulai koding:
   npm run dev
Web otomatis bisa diakses di browser pada alamat: http://localhost:3000

STRUKTUR MODUL PROJEK
* app/        : Mengatur rute halaman tampilan web dan endpoint API backend.
* components/ : Tempat kodingan potongan UI (Form login, tabel data KOL).
* lib/        : Berisi script logika query database Prisma (CRUD data KOL).
* prisma/     : Berisi file schema.prisma (Definisi tabel KOL dan Admin).

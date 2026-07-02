# Jurnal Trading

Aplikasi web jurnal trading pribadi. Login per akun, data disimpan di Firebase Firestore,
tiap user hanya bisa lihat datanya sendiri.

## Cara pakai (development lokal)
1. Isi `firebase-config.js` dengan config project Firebase lo.
2. Buka folder ini di VS Code, install extension "Live Server", klik kanan `index.html` > "Open with Live Server".

## Fitur
- Login / daftar (Firebase Authentication - Email & Password)
- Tambah, edit, hapus catatan trade (pair, arah, entry/exit, size, P&L, catatan)
- Statistik otomatis: total trade, win rate, total P&L, rata-rata profit/loss
- Grafik equity curve (kumulatif P&L)
- Filter berdasarkan pair, arah, dan hasil (profit/loss)

## Deploy
Lihat panduan lengkap yang diberikan terpisah (setup Firebase > GitHub > Vercel).

Lengkapi juga rules Firestore di Firebase Console dengan isi file `firestore.rules`
supaya data user aman.

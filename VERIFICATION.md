# Hasil verifikasi program

## Program dan deployment

- PASS: ketiga proyek Wokwi cloud dikompilasi dan simulasi berjalan; lokasi A telah menerbitkan payload MQTT. Kompilasi lokal sebelumnya menggunakan dengan ESP32 Arduino core 3.3.12, ArduinoMqttClient 0.1.8, DHT sensor library 1.4.7, dan Adafruit Unified Sensor 1.1.15.
- PASS: masing-masing memakai 917554 byte flash dan 48492 byte RAM; hasil kompilasi tersedia dalam arsip lokal.
- PASS: 11 pengujian Node meliputi format hash, manipulasi kedua salinan, range payload, duplicate ID, konflik ID, missing replica, rantai terputus, batas jendela, retry penulisan, ingest, dan fallback baca.
- PASS: pipeline lokal MQTT QoS1 → spool SQLite → HTTPS/HTTP ingest → Queue lokal → D1 lokal menerima 9 pembacaan dari 18 publikasi tanpa data ganda.
- PASS: `npm run check` dan build Worker selesai. Deployment final Worker ID versi `b5c27288-fd0b-4281-8f35-2823bd871f5f`.
- PASS: custom domain HTTPS merespons; D1 online; ingest tanpa token HTTP 401; ingest dengan konfigurasi Neon belum tersedia HTTP 503.
- PASS: koneksi ke broker publik `test.mosquitto.org:1883` berhasil dari host pengembangan.

## Batas verifikasi

- Tiga proyek cloud sudah tersimpan, tautan tersedia di WOKWI.md. Proyek dibuat tanpa login ke akun pengguna. Lokasi B mengalami kegagalan koneksi gateway jaringan Wokwi saat uji awal; kompilasi berhasil, tetapi publikasi MQTT B/C belum terverifikasi.
- Neon project `blue-tree-06987967` berhasil dibuat. Connection string belum tersedia pada Worker, sehingga replikasi dan fallback ke Neon sungguhan belum diuji. Uji driver Neon menggunakan respons HTTP terkendali, bukan database live.
- Tidak ada pembacaan sintetis pada produksi. Data pipeline hanya ada di D1 lokal. Dashboard produksi menampilkan keadaan menunggu.
- Bridge belum dipasang pada host yang selalu aktif. Jalankan bridge sebelum menjalankan Wokwi, setelah Neon dikonfigurasi.
- Pemeriksaan browser memakai lebar aktual 480 dan 664 piksel. Override ukuran 375/1280 pada browser in-app tidak mengubah lebar DOM; ukuran tersebut tidak diklaim sudah diuji.

## Antislop: Hard Gate

- R-02 PASS: teks UI memakai tanda minus ganda untuk nilai kosong; tidak ada em dash.
- R-03 PASS: screenshot pada lebar aktual 480 dan 664 menunjukkan susunan satu/dua kolom; pengukuran DOM 664 menunjukkan scrollWidth = innerWidth. Tabel memiliki scroll container sendiri. Batas ukuran yang belum diuji tercatat di atas.
- R-17 PASS: angka pemeriksaan berasal dari jumlah records API; nilai produksi kosong, bukan statistik fiktif.
- R-18 PASS: tidak ada testimonial atau avatar.
- R-23 PASS: tidak ada logo/ilustrasi/aset visual buatan; lokasi A/B/C berasal dari brief pengguna.
- R-24 PASS: tidak ada navbar atau tautan ke halaman yang tidak tersedia.
- R-25 PASS: semua pasangan warna teks normal/muted/accent/danger terhadap background/surface memiliki rasio kontras minimal 8.02:1.
- R-26 PASS: refresh, pause/resume, filter A/B/C, pilihan metrik, detail hash, tutup, Escape, dan unduh CSV diuji; CSV tersimpan sebagai `tp2-lokasi-B.csv`.
- R-27 PASS: loading status pada HTML, empty state diamati pada produksi, error alert dan pemeliharaan data lama tersedia pada handler refresh gagal; status cloud tidak dipertahankan sebagai online saat refresh gagal.
- R-28 PASS: tidak ada FAQ.
- R-32 PASS: kontrol memakai button/select native; kontrol pembaruan dapat dioperasikan dengan keyboard dan outline fokus solid 3px, Escape menutup dialog.
- R-33 PASS: HTML/CSS/JS ditulis langsung pada file sumber menggunakan patch; tidak ada script patch UI eksternal.
- R-34 PASS: tampilan dashboard diuji pada browser, termasuk dialog hash.
- R-35 PASS: program dibangun, dashboard lokal dan produksi dijalankan, semua jenis kontrol diuji, dan log error browser lokal kosong saat pengecekan.
- R-36 PASS: tidak ada klaim keamanan/uptime/blockchain palsu; keterbatasan hash ditampilkan pada dashboard.
- R-37 PASS: arah desain berasal dari pilihan pengguna, panel monitoring sederhana; dials dan alasan tersimpan di DESIGN.md.
- R-38 PASS: screenshot akhir berasal dari produksi yang masih menunggu sensor; fixture sintetis hanya dipakai pada lingkungan lokal.

## Antislop: Purpose Gate

- R-01 PASS: tidak ada gradient/glow.
- R-04 PASS: tidak memakai ikon generik atau library ikon.
- R-06 PASS: system UI font untuk keterbacaan; monospace dibatasi hash, alasannya di DESIGN.md.
- R-07 PASS: tidak ada pola grid/dekorasi latar; garis pada SVG adalah sumbu grafik sensor.
- R-08 PASS: tidak ada panah dekoratif pada tombol.
- R-09 PASS: status ditampilkan sebagai teks, tanpa badge dekoratif.
- R-10 PASS: tidak ada glassmorphism atau backdrop blur.
- R-12 PASS: tidak ada shadow besar pada panel.
- R-13 PASS: tidak ada glow.
- R-14 PASS: panel lokasi setara karena ketiga sensor punya kedudukan sama; grafik, status cloud, dan tabel memakai bentuk yang sesuai fungsi.
- R-19 PASS: tidak ada animasi template/otomatis; MOTION 1 mengutamakan pembacaan data.
- R-22 PASS: tidak memakai ilustrasi stok/generik.

## Antislop: Liveliness

- Dials PASS: ENERGY 1 / RHYTHM 2 / MOTION 1 tercatat di DESIGN.md dan komentar proses sebelum implementasi.
- Konsistensi PASS: angka sensor dominan, grafik lebar, dan tabel bukti; tidak ada gerakan dekoratif.
- Focal point PASS: nilai suhu terbaru menjadi elemen terbesar pada tiap lokasi, heading halaman menetapkan konteks.
- Whitespace PASS: spacing memisahkan sensor, riwayat, cloud, dan jejak pembacaan.
- Accent PASS: hijau dipakai untuk kurva data dan kecocokan hash, bukan seluruh permukaan.
- Identity PASS: lokasi A/B/C konsisten pada firmware, panel, filter, dan payload.
- Design Read PASS: panel monitoring untuk demo IoT dengan dials yang dinyatakan sebelum UI ditulis.

## Antislop: Craftsmanship

- C-1 PASS: alasan warna, font, komposisi, radius, dan gerakan dicatat pada DESIGN.md.
- C-2 PASS: kontrol mempunyai perilaku nyata yang diuji; ekspor disabled saat records kosong.
- C-3 PASS: bagian halaman mengikuti kebutuhan pembacaan sensor, status penyimpanan, dan pemeriksaan hash.
- C-4 PASS: keyboard, dialog, keadaan kosong, data lama, dan dua lebar aktual diuji; batas QA desktop tercatat di atas.
- C-5 PASS: produksi tidak mengandung fixture sintetis atau klaim pelanggan/statistik buatan.
- R-05 PASS: susunan monitoring mengikuti brief, bukan landing page; panel sensor, grafik, cloud, dan tabel berbeda fungsi/komposisi.
- R-11 PASS: radius panel 6px, dialog 8px, kontrol 5px; tidak ada bentuk pill.
- R-15 PASS: tombol menamai aksi: Perbarui data, Jeda pembaruan, Periksa hash, Unduh CSV lokasi.
- R-16 PASS: teks UI faktual dan tidak memakai jargon pemasaran AI.
- R-20 PASS: identitas lokasi A/B/C, jejak hash, dan pasangan cloud langsung mengikuti proyek pengguna.
- R-21 PASS: kontrol pembaruan bekerja, diuji melalui jeda dan lanjut pembaruan.
- R-29 PASS: palette netral, hijau aksen, merah untuk masalah; tidak ada warna tambahan dekoratif.
- R-30 PASS: halaman tidak menyalin identitas produk lain.
- R-31 PASS: keputusan utama memiliki alasan pada DESIGN.md.


Deploy terbaru: f16f7a6d-cd49-4355-9061-6fc1f8db7b8d. Pemeriksaan sintaks JavaScript dan git diff --check lulus.

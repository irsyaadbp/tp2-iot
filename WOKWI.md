# Simulasi Wokwi cloud

Tiga proyek ESP32 + DHT22 dijalankan langsung di Wokwi online:

- [Lokasi A](https://wokwi.com/projects/477479053733443585)
- [Lokasi B](https://wokwi.com/projects/477479046676524033)
- [Lokasi C](https://wokwi.com/projects/477479062154561537)

Buka setiap tautan di tab terpisah dan klik Run. Klik komponen DHT22 untuk mengubah suhu dan kelembapan. Firmware menerbitkan pembacaan setiap 5 detik setelah WiFi, MQTT, dan waktu NTP tersedia.

Broker: `test.mosquitto.org:1883`. Topic: `tp2/irsyaad-7fa913c2/+/telemetry`. Jalankan `npm run bridge` dari repository untuk meneruskan pembacaan ke API. Data dapat tampil melalui D1 meskipun Neon belum tersedia; replikasi cadangan menunggu konfigurasi Neon.

Tautan di atas mengarah ke salinan proyek pada akun pengguna. Firmware dan diagram dikelola di editor Wokwi online.

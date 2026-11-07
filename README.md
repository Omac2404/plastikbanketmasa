# plastikbanketmasa.com

Plastik Banket Masa kurumsal sitesi ve yönetim paneli. Node.js (Express + EJS), SQLite, sunucu tarafında üretilen sayfalar.

Eski WordPress sitesinin tüm içeriği, görselleri ve kurulum videosu ilk açılışta veritabanına otomatik yüklenir. Eski adresler aynen korunur (`/plastik-banket-masa`, `/hakkimizda` vb.); sonda `/` olan eski bağlantılar 301 ile yönlenir.

## Yerelde çalıştırma

```bash
npm install
ADMIN_PASSWORD=GucluBirParola123 npm run dev
```

Site: http://localhost:3000 · Panel: http://localhost:3000/panel (kullanıcı adı `admin`)

`ADMIN_PASSWORD` verilmezse ilk açılışta geçici parola üretilir ve konsola yazılır. Parola yalnızca **ilk kurulumda** (boş veritabanı) kullanılır; sonradan panelden değiştirilir.

## Easypanel'e kurulum

1. **App** servisi oluşturun, kaynak olarak GitHub `Omac2404/plastikbanketmasa`, derleme yöntemi **Dockerfile**.
2. **Mounts** bölümünde bir **Volume** ekleyin: mount path `/app/data`. Veritabanı, yüklenen görseller ve yedekler burada durur. Bu adım atlanırsa her deploy'da içerik sıfırlanır.
3. **Environment**:

   | Değişken | Açıklama |
   |---|---|
   | `SESSION_SECRET` | Uzun rastgele bir metin (ör. `openssl rand -hex 32`). Zorunlu. |
   | `ADMIN_PASSWORD` | İlk yönetici parolası (ilk açılışta kullanılır). |
   | `ADMIN_USERNAME` | Varsayılan `admin`. |
   | `ADMIN_EMAIL` | Varsayılan `info@webreta.com.tr`. |
   | `SITE_URL` | `https://www.plastikbanketmasa.com` |

4. **Domains**: `www.plastikbanketmasa.com` ve `plastikbanketmasa.com`, port `3000`. Easypanel'de çıplak alan adını `www`'ya yönlendirin.
5. Deploy. Sağlık kontrolü adresi: `/healthz`.

## Yönetim paneli

| Bölüm | Ne yapılır |
|---|---|
| Sayfalar | Ana sayfa, Hakkımızda, İletişim, Plastik Sandalye, Blog ve yasal metinlerin tüm metin ve görselleri; sayfa bazında SEO. |
| Ürünler | Ürün ekleme, düzenleme, kopyalama, sıralama; renk seçenekleri, galeri, teknik bilgiler, kurulum videosu, ürüne özel telefon. |
| Ortak alanlar | Telefonlar, WhatsApp, e-posta, adres, harita, sosyal medya, logo, footer. |
| Blog | Yazılar (markdown editör, ileri tarihli yayın, çöp kutusu) ve kategoriler. |
| Medya | Sürükle-bırak yükleme. Görseller otomatik WebP'ye çevrilir, 480/1024/1920 px boyutlarında saklanır. Silmeden önce nerede kullanıldığı gösterilir. |
| Form başvuruları | İletişim formundan gelenler; okundu, yıldız, arşiv, CSV indirme, bildirim e-postası adresi. |
| Menüler | Header (alt menülü) ve footer bağlantıları. |
| Site öğeleri | WhatsApp yüzen butonu ve mobil alt menü. |
| SEO | Başlık şablonu, varsayılan açıklama, paylaşım görseli, favicon, Google Tag Manager, arama motorlarına açık/kapalı. |
| Ayarlar | Site adı, panel rengi, bakım modu, SMTP (e-posta) ve test gönderimi, yedekleme ve geri yükleme. |
| Kullanıcılar | Editör / Yönetici / Süper admin rolleri. |
| Aktivite | Panelde kim ne yaptı. |

## Notlar

- Google Tag Manager ve analiz çerezleri yalnızca ziyaretçi çerez bildiriminde onay verirse yüklenir. YouTube (youtube-nocookie) ve Google Haritalar tıklanana kadar yüklenmez.
- `sitemap.xml` ve `robots.txt` otomatik üretilir.
- Panel yedeği veritabanını kapsar; görsel dosyaları için Easypanel volume yedeğini kullanın.

## Klasörler

```
src/            sunucu (server.js, db.js, seed.js, schemas.js, routes/, lib/)
views/          EJS şablonları (site/, panel/, partials/)
public/         CSS ve JS
seed-media/     eski siteden alınan görseller (ilk kurulumda medya kütüphanesine aktarılır)
data/           çalışma verisi: site.db, uploads/, backups/ (git'e girmez)
```

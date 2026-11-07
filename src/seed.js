'use strict';
/**
 * İlk kurulum: mevcut plastikbanketmasa.com içeriğini, görsellerini ve
 * varsayılan ayarları veritabanına yükler. Yalnızca boş veritabanında çalışır.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, setSetting, getSetting, logActivity } = require('./db');
const { SEED_MEDIA_DIR, ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD } = require('./config');
const { processUpload } = require('./lib/media');
const { hashPassword } = require('./lib/auth');
const { slugify } = require('./lib/util');

const ALT = {
  'IMG_7454.webp': 'Bahçede kurulmuş beyaz plastik banket masa ve tiffany sandalyeler',
  'IMG_7457-3.webp': 'Plastik banket masanın alt iskeleti ve sandalyeler',
  'IMG_7479-2.webp': 'Açık havada kurulmuş plastik banket masa',
  'Dugun-Salonu-Masasi.webp': 'Gün batımında bahçede kurulmuş düğün masası',
  'Plastik-Banket-Masa-Dugun-Salonu-Masasi-2.webp': 'Çim alanda tiffany sandalyelerle kurulmuş yuvarlak plastik banket masa',
  'Plastik-Banket-Masa-Ureticisi.webp': 'Plastik banket masa üretiminde kullanılan enjeksiyon kalıbı',
  'Plastik-Banket-Masa-Saticisi.webp': 'Plastik Banket Masa üretim tesisi',
  'Plastik-Banket-Masa-Totem-1920x500.webp': 'Plastik Banket Masa tabelası',
  'Plastik-Banket-Masa-Ust.webp': 'Plastik banket masanın üstten görünümü',
  'Plastik-Banket-Masa-Alt.webp': 'Plastik banket masanın alttan görünümü ve metal ayakları',
  'Plastik-Banket-Masa-Kutu-1.webp': 'Plastik banket masa ve karton kutusu',
  'Banket-Masa-Kutusu-2.webp': 'Plastik Banket Masa logolu ürün kutusu',
  'Kurulum-scaled.webp': 'Plastik banket masanın kurulum parçaları',
  'Banket-Masa-Kurulumu.webp': 'Plastik banket masa tabla parçaları',
  'PBMPOST-2.webp': 'Bahçede kurulmuş yuvarlak plastik banket masa',
  'Plastik-Banket-Masa-Logo-HQ.webp': 'Plastik Banket Masa logosu',
  'Plastik-Banket-Masa-Logo-HQ-Beyaz.webp': 'Plastik Banket Masa logosu',
  'katlanir-canta-masa-1.jpg': 'Katlanır çanta masa açık ve katlanmış hali',
  'plastik-katlanir-canta-masa-banket.jpg': 'Plastik katlanır çanta masa',
  'plastik-katlanir-canta-masa.jpg': 'Plastik katlanır çanta masa yandan görünüm',
  '18.jpg': 'Beyaz plastik kafe dış mekan sandalyesi',
  '19.jpg': 'Beyaz tiffany düğün sandalyesi',
  'Tiffany-Dugun-Sandalyesi-1.jpg': 'Beyaz tiffany düğün sandalyesi',
  'Tiffany-Sandalyeler.jpg': 'Uzun masa etrafında tiffany sandalyeler',
  'Tiffany-Dugun-Sandalyesi-2.jpg': 'Yuvarlak masa etrafında tiffany sandalyeler',
  'Tiffany-Sandalye.jpg': 'Bahçede tiffany sandalye',
  'Tiffany-Sandalye-Ureticisi.jpg': 'Tiffany sandalyeler',
  'Plastik-Kafe-Sandalyesi.jpg': 'Beyaz plastik kafe sandalyesi',
  'Plastik-Kafe-Dis-Mekan-Sandalyesi.jpg': 'Plastik kafe dış mekan sandalyesi',
  'Plastik-Sari-Dis-Mekan-Sandalyesi.jpg': 'Sarı plastik dış mekan sandalyesi',
  'plastik-ic-dis-mekan-sandalye-1.jpg': 'Plastik iç ve dış mekan sandalyesi',
  'Plastik-Bahce-Kafe-Sandalyesi.jpg': 'Bahçede plastik kafe sandalyesi',
  'Plastik-Kafe-Sandalyesi-1.jpg': 'Çimde beyaz plastik kafe sandalyesi',
  'Plastik-Organizayon-Sandalyeleri.jpg': 'Organizasyon için plastik sandalyeler',
  'Plastik-Sandalye.jpg': 'Plastik sandalye',
  'cropped-plastik-banket-masa-ikon-270x270.webp': 'Plastik Banket Masa simgesi',
};

async function importSeedMedia() {
  const map = {};
  if (!fs.existsSync(SEED_MEDIA_DIR)) return map;
  for (const f of fs.readdirSync(SEED_MEDIA_DIR).sort()) {
    const full = path.join(SEED_MEDIA_DIR, f);
    if (!fs.statSync(full).isFile()) continue;
    try {
      const ext = path.extname(f).toLowerCase();
      const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg';
      const r = await processUpload(fs.readFileSync(full), f, mime);
      if (ALT[f]) db.prepare('UPDATE media SET alt = ? WHERE id = ?').run(ALT[f], r.id);
      map[f] = r.url;
    } catch (e) {
      console.warn('[seed] görsel atlandı:', f, e.message);
    }
  }
  return map;
}

function legalKvkk() {
  return `Plastik Banket Masa olarak kişisel verilerinizin güvenliğine önem veriyoruz. Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla sizi bilgilendirmek amacıyla hazırlanmıştır.

## Veri sorumlusu

Plastik Banket Masa
Kemalpaşa Mah. 7416 Sk. 35060 Bornova / İzmir
E-posta: info@plastikbanketmasa.com

## İşlenen kişisel veriler

İletişim formunu doldurduğunuzda adınız, telefon numaranız, e-posta adresiniz (isteğe bağlı) ve mesajınız işlenir. Ayrıca güvenlik amacıyla form gönderiminin yapıldığı IP adresi ve tarih bilgisi kaydedilir.

## İşleme amaçları

- Talebinize dönüş yapmak ve fiyat teklifi hazırlamak
- Sipariş ve satış süreçlerini yürütmek
- Yasal yükümlülüklerimizi yerine getirmek
- Web sitesinin güvenliğini sağlamak ve kötüye kullanımı önlemek

## Hukuki sebep

Kişisel verileriniz KVKK'nın 5. maddesinde yer alan "bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması", "veri sorumlusunun meşru menfaati" ve "hukuki yükümlülüğün yerine getirilmesi" hukuki sebeplerine dayanılarak işlenir.

## Aktarım

Kişisel verileriniz yalnızca yukarıdaki amaçlarla sınırlı olarak; yasal zorunluluk halinde yetkili kamu kurumlarına ve hizmet aldığımız barındırma ve e-posta sağlayıcılarına aktarılabilir. Verileriniz pazarlama amacıyla üçüncü kişilerle paylaşılmaz.

## Saklama süresi

Form başvuruları, talebiniz sonuçlandıktan sonra en fazla 2 yıl saklanır ve ardından silinir veya anonim hale getirilir.

## Haklarınız

KVKK'nın 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme ve işlemeye itiraz etme haklarına sahipsiniz. Taleplerinizi info@plastikbanketmasa.com adresine iletebilirsiniz. Başvurular en geç 30 gün içinde yanıtlanır.`;
}

function legalCerez() {
  return `Bu sayfa, plastikbanketmasa.com adresinde hangi çerezlerin neden kullanıldığını açıklar.

## Çerez nedir?

Çerezler, bir web sitesini ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyalarıdır.

## Kullandığımız çerezler

**Zorunlu çerezler.** Sitenin çalışması için gereklidir. Çerez tercihinizi hatırlamak için kullanılan kayıt bu gruptadır. Bu çerezler kapatılamaz.

**Analiz çerezleri.** Ziyaretçi sayısını ve hangi sayfaların ilgi gördüğünü anlamak için Google Tag Manager ve Google Analytics kullanılabilir. Bu çerezler yalnızca çerez bildiriminde "Kabul et" seçeneğini işaretlerseniz yüklenir.

**Üçüncü taraf içerikler.** YouTube videoları ve Google Haritalar, siz oynat ya da haritayı göster butonuna basana kadar yüklenmez. Bastığınızda ilgili hizmetin kendi çerezleri devreye girebilir.

## Tercihinizi değiştirmek

Tercihinizi istediğiniz zaman sayfanın en altındaki "Çerez tercihleri" bağlantısından değiştirebilir veya tarayıcı ayarlarınızdan çerezleri silebilirsiniz.`;
}

function legalKosullar() {
  return `plastikbanketmasa.com web sitesini kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız.

## Site içeriği

Sitedeki metinler, fotoğraflar, logo ve videolar Plastik Banket Masa'ya aittir. İzin alınmadan ticari amaçla kopyalanamaz veya çoğaltılamaz.

## Ürün bilgileri ve fiyatlar

Sitede yer alan ürün bilgileri tanıtım amaçlıdır. Renk ve ölçüler üretim partisine göre küçük farklılıklar gösterebilir. Sitede fiyat yayınlanmaz; güncel fiyat ve teslim süresi için bizimle iletişime geçmeniz gerekir. Satış, taraflar arasında ayrıca yapılan sipariş ve sözleşme hükümlerine tabidir.

## Bağlantılar

Sitede YouTube, Instagram gibi üçüncü taraf hizmetlere bağlantılar bulunabilir. Bu sitelerin içeriğinden ve gizlilik uygulamalarından Plastik Banket Masa sorumlu değildir.

## Değişiklikler

Plastik Banket Masa bu koşulları önceden haber vermeksizin güncelleyebilir. Güncel metin her zaman bu sayfada yayınlanır.

## İletişim

Sorularınız için info@plastikbanketmasa.com adresine yazabilirsiniz.`;
}

function blogBody(U) {
  return `Plastik banket masaları, çeşitli etkinliklerde kullanılan ve bir dizi avantaj sunan pratik ve çok yönlü mobilyalardır. İşte plastik banket masalarının bazı önemli avantajları:

## 1. Hafiflik ve taşınabilirlik

Plastik banket masaları genellikle hafif malzemelerden yapılmıştır, bu da onları kolayca taşınabilir kılar. Bu özellik, etkinliklerin planlanması ve düzenlenmesi sırasında büyük bir kolaylık sağlar. Masaları istenilen yere kolayca taşımak ve düzenlemek için minimum efor gerektirir.

## 2. Dayanıklılık ve uzun ömür

Plastik banket masaları, darbelere ve aşınmaya karşı dayanıklı olan sağlam malzemelerden üretilir. Bu, masaların uzun ömürlü olmasını sağlar ve tekrar tekrar kullanılabilirliklerini artırır. Ayrıca, çeşitli hava koşullarına karşı dayanıklı oldukları için iç ve dış mekan etkinliklerinde güvenle kullanılabilirler.

![Plastik banket masa üst tarafı](${U('Plastik-Banket-Masa-Ust.webp')})

![Plastik banket masa alt tarafı](${U('Plastik-Banket-Masa-Alt.webp')})

## 3. Kolay temizlik ve bakım

Plastik banket masaları, genellikle pürüzsüz bir yüzeye sahiptir ve bu da temizliğini kolaylaştırır. Basit bir bez veya deterjanlı su ile temizlenerek, masaların hijyenik bir şekilde tutulması sağlanır. Ayrıca, plastik malzemenin leke ve sıvıları emmemesi, temizlik işlemini daha da kolaylaştırır.

## 4. Ekonomik ve ekolojik

Plastik banket masaları genellikle uygun fiyatlıdır ve diğer masalara kıyasla daha ekonomik bir seçenek sunarlar. Ayrıca, plastik malzemenin geri dönüşüme uygun olması, çevresel açıdan daha sürdürülebilir bir seçim yapmayı sağlar.

![Plastik banket masa kutusu](${U('Plastik-Banket-Masa-Kutu-1.webp')})

## 5. Çeşitli renk ve tasarım seçenekleri

Plastik banket masaları, çeşitli renk ve tasarım seçenekleri sunar, böylece her türlü etkinlik temasına uyum sağlayabilirler. Bu, etkinlik düzenleyicilerine ve organizatörlere geniş bir yaratıcılık ve esneklik alanı sunar.

Plastik banket masaları, pratiklik, dayanıklılık, ekonomiklik ve estetik gibi birçok avantaj sunarak, çeşitli etkinlikler için ideal masa çözümüdür. Hem kullanıcılar hem de organizatörler için bir dizi fayda sağlayarak, etkinliklerin başarılı ve keyifli geçmesine katkıda bulunurlar.`;
}

async function seed() {
  const hasUsers = db.prepare('SELECT COUNT(*) n FROM users').get().n > 0;
  if (hasUsers) return;
  console.log('[seed] Boş veritabanı: ilk içerik yükleniyor...');

  const map = await importSeedMedia();
  const U = (f) => map[f] || '';

  /* ---- yönetici ---- */
  let pw = ADMIN_PASSWORD;
  if (!pw) {
    pw = crypto.randomBytes(9).toString('base64url');
    console.log('\n============================================');
    console.log(' Panel girişi: /panel');
    console.log(' Kullanıcı adı:', ADMIN_USERNAME);
    console.log(' Geçici parola:', pw);
    console.log(' (ADMIN_PASSWORD ortam değişkeni ile belirleyebilirsiniz)');
    console.log('============================================\n');
  }
  db.prepare('INSERT INTO users(name, email, username, pass, role) VALUES(?,?,?,?,?)')
    .run('Webreta', ADMIN_EMAIL, ADMIN_USERNAME, hashPassword(pw), 'superadmin');

  const tx = db.transaction(() => {
    /* ---- ortak alanlar ---- */
    setSetting('contact', {
      phone: '+90 531 492 75 95',
      phone_sales: '0546 900 09 40',
      whatsapp: '+90 531 492 75 95',
      whatsapp_text: 'Merhaba, plastik banket masa hakkında bilgi almak istiyorum.',
      email: 'info@plastikbanketmasa.com',
      address: 'Kemalpaşa Mah. 7416 Sk.\n35060 Bornova / İzmir',
      hours: 'Pazartesi - Cuma, 09.00 - 18.00',
      map_embed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3125.1784985409845!2d27.27304077688549!3d38.43734577371643!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14b97b53008a74bf%3A0xf36e40d3b770fec3!2sKemalpa%C5%9Fa%2C%207416.%20Sk.%2C%2035060%20Bornova%2F%C4%B0zmir!5e0!3m2!1str!2str!4v1710074677874!5m2!1str!2str',
      map_link: 'https://www.google.com/maps/search/?api=1&query=Kemalpa%C5%9Fa%2C+7416.+Sk.%2C+35060+Bornova%2F%C4%B0zmir',
    });
    setSetting('social', {
      instagram: 'https://www.instagram.com/plastikbanketmasa/',
      facebook: 'https://www.facebook.com/profile.php?id=61556658495023',
      linkedin: 'https://www.linkedin.com/company/plastik-banket-masa',
      youtube: 'https://www.youtube.com/@plastikbanketmasa',
    });
    setSetting('header', { logo: U('Plastik-Banket-Masa-Logo-HQ.webp'), cta_text: 'Fiyat teklifi alın', cta_url: '/iletisim' });
    setSetting('footer', {
      logo: U('Plastik-Banket-Masa-Logo-HQ-Beyaz.webp'),
      about: 'Plastik Banket Masa, 2024 yılında İzmir’de kurulmuştur. Plastik ürün ve ekipman üretimi üzerine uzmanlaşmış kadrosu ile banket masa sektörüne hızlı bir giriş gerçekleştirmiştir.',
      company: 'Plastik Banket Masa',
    });
    setSetting('site', { name: 'Plastik Banket Masa', panel_name: 'Plastik Banket Masa Paneli', accent: '#FF7A28', maintenance: false, maintenance_text: 'Sitemiz kısa bir bakım çalışması nedeniyle kapalıdır. Bize telefonla ulaşabilirsiniz.' });
    setSetting('seo', {
      title_tpl: '%page% | %site%',
      description: 'Türkiye’nin ilk ve tek plastik banket masa üreticisi. Düğün salonları, organizasyon firmaları ve etkinlikler için dayanıklı, kolay kurulan plastik banket masa ve sandalyeler.',
      og_image: U('PBMPOST-2.webp'),
      favicon: U('cropped-plastik-banket-masa-ikon-270x270.webp'),
      site_url: 'https://www.plastikbanketmasa.com',
      indexable: true,
      gtm_id: 'GTM-5N9CJHGJ',
    });
    setSetting('forms', { notify_to: 'info@plastikbanketmasa.com', success: 'Mesajınız bize ulaştı. Mesai saatleri içinde en kısa sürede dönüş yapacağız.' });
    setSetting('widgets', {
      floating: { enabled: true, position: 'right', items: [
        { icon: 'whatsapp', label: 'WhatsApp’tan yazın', url: '', visibility: 'all' },
      ] },
      mobilebar: { enabled: true, items: [
        { icon: 'phone', label: 'Ara', url: '', visibility: 'mobile' },
        { icon: 'whatsapp', label: 'WhatsApp', url: '', visibility: 'mobile' },
        { icon: 'mail', label: 'Teklif al', url: '/iletisim#form', visibility: 'mobile' },
      ] },
    });
    setSetting('smtp', {});

    /* ---- sayfalar ---- */
    const insPage = db.prepare('INSERT INTO pages(key, slug, title, data, seo_title, seo_desc) VALUES(?,?,?,?,?,?)');
    insPage.run('home', '', 'Ana Sayfa', JSON.stringify({
      hero: {
        title: 'Yüksek kaliteli **plastik banket masa**',
        text: 'Türkiye’nin ilk ve tek plastik banket masa üreticisi olmanın haklı gururuyla çıktığımız yolda hız kesmeden plastik banket masa satışlarımıza devam ediyoruz.',
        image: U('Plastik-Banket-Masa-Dugun-Salonu-Masasi-2.webp'),
        image_alt: 'Çim alanda tiffany sandalyelerle kurulmuş yuvarlak plastik banket masa',
        btn_text: 'Plastik banket masayı inceleyin', btn_url: '/plastik-banket-masa',
        btn2_text: 'Kurulum videosunu izleyin', btn2_url: '#kurulum',
      },
      values: {
        title: 'Bizi biz yapan birkaç şey',
        image: U('IMG_7457-3.webp'),
        items: [
          { title: 'Yüksek kaliteli üretim', text: 'Yüksek kalite, kusursuz işçilikle birleşiyor ve ortaya mükemmel ürünler çıkıyor.' },
          { title: 'Doğru fiyat politikası', text: 'Başarılı fiyat politikamız ile ürünlerimizi en uygun fiyat üzerinden satıyoruz.' },
          { title: 'Müşteri memnuniyeti', text: 'Başladığımız yolculuğa %100 müşteri memnuniyeti ile devam ediyoruz.' },
        ],
      },
      producer: {
        title: 'Üretici olmanın gururu',
        text: 'Plastik Banket Masa olarak banket masa sektörü içerisinde bir üretici firma olmanın haklı gururunu yaşıyoruz. Üretici olmanın verdiği avantajlar yardımıyla ar-ge süreçlerimizi esnek tutuyor, en iyi ürünü ortaya çıkarıyoruz. Ürünlerimizi yüksek kaliteli materyallerden üretiyor, kullanıcılarımıza eşsiz bir deneyim sunuyoruz.',
        image1: U('Plastik-Banket-Masa-Ureticisi.webp'),
        image2: U('Plastik-Banket-Masa-Saticisi.webp'),
        btn_text: 'Firmamızı tanıyın', btn_url: '/hakkimizda',
      },
      products: { title: 'Ürünlerimiz', text: 'Düğün salonları, organizasyon firmaları, kafe ve restoranlar için masa ve sandalye çözümleri.' },
      quality: {
        title: 'Kalite politikamız',
        text: 'Her bir masamız, titizlikle seçilmiş en iyi kalitedeki malzemelerle üretilir ve uzman işçilikle işlenir. Plastik Banket Masamız her türlü etkinlik ve organizasyonda şıklık ve prestij sağlar.\n\nMüşteri memnuniyetini en üst düzeye çıkarmak için sürekli olarak ürünlerimizi geliştiriyor ve ihtiyaçları karşılamak için özelleştirme seçenekleri sunuyoruz. Müşterilerimize sadece mükemmel ürünler sunmakla kalmayıp aynı zamanda üstün hizmet kalitesiyle de destek oluyoruz.',
        btn_text: 'Hakkımızda daha fazlası', btn_url: '/hakkimizda',
      },
      video: {
        title: 'İşte birkaç adımda plastik banket masanın kurulumu',
        text: 'Plastik banket masa kurulumu sıradan banket masalara göre oldukça kolaydır ve ekstra hiçbir maliyet gerektirmez.',
        steps: [
          { text: 'Tabla parçalarını birleştirin' },
          { text: 'Metal iskeleti yerleştirin' },
          { text: 'Ayakları takın, masa hazır' },
        ],
        youtube: 'https://youtu.be/wUQcXNif1Xg',
        poster: U('IMG_7479-2.webp'),
      },
      stats: { items: [
        { value: '', label: 'Teslim edilen ürün' },
        { value: '', label: 'Mutlu müşteri' },
        { value: '', label: 'İhracat yapılan ülke' },
      ] },
      shipping: {
        title: 'Düşük taşıma maliyetleri',
        text: 'Düşük depolama maliyetlerinin tadını çıkarın. Plastik banket masa kurulum öncesi ve sonrası minimum alan kaplamak için tasarlanmıştır. Bu sayede en düşük taşıma maliyetleriyle toptan plastik banket masa satın alımı yapabilirsiniz.',
        image: U('Plastik-Banket-Masa-Kutu-1.webp'),
        btn_text: 'Toptan fiyat teklifi alın', btn_url: '/iletisim#form',
      },
      contact: { title: 'Bizimle iletişime geçin', text: 'Adet, ölçü ve teslim yeri bilgisini yazın; size fiyat teklifiyle dönelim.' },
    }), 'Plastik Banket Masa | Türkiye’nin Plastik Banket Masa Üreticisi', 'Türkiye’nin ilk ve tek plastik banket masa üreticisi olmanın haklı gururuyla çıktığımız yolda hız kesmeden plastik banket masa satışlarımıza devam ediyoruz.');

    insPage.run('hakkimizda', 'hakkimizda', 'Hakkımızda', JSON.stringify({
      intro: {
        title: 'Hakkımızda',
        lead: 'İzmir’de, 2024’ten beri plastik banket masa üretiyoruz.',
        text: 'Plastik Banket Masa, 2024 yılında güzel İzmir şehrinde kurulmuş ve plastik ürün ve ekipman üretimi alanında uzmanlaşmış dinamik ve deneyimli kadrosuyla kısa sürede banket masa sektöründe dikkat çekici bir varlık göstermiştir. Şirket, modern üretim tesisleri ve ileri teknoloji kullanarak kaliteli, dayanıklı ve estetik banket masaları üretme konusunda hızla kendini kanıtlamıştır.\n\nKuruluşundan bu yana, Plastik Banket Masa, müşteri memnuniyetini en üst düzeyde tutmayı hedeflemiş ve bu doğrultuda sürekli olarak yenilikçi çözümler geliştirmiştir. Şirket, geniş bir pazar ağına hitap ederek, hem yerel hem de uluslararası alanda büyümeyi hedeflemektedir.\n\nPlastik Banket Masa’nın misyonu, yüksek kaliteli ve çevre dostu ürünler sunarak sektörde lider konuma gelmek ve müşterilerinin beklentilerini aşan çözümler üretmektir. İzmir’deki stratejik konumu, lojistik avantajları ve güçlü tedarik zinciri sayesinde, müşterilerine hızlı ve etkili hizmet sağlamaktadır. Ayrıca, şirketin Ar-Ge departmanı, sürekli olarak yeni ürün geliştirme ve mevcut ürünleri iyileştirme çalışmaları yaparak, rekabetçi avantajını korumaktadır.\n\nPlastik Banket Masa, kurulduğu günden bu yana elde ettiği başarılarla sektöründe güvenilir bir marka haline gelmiş ve sektördeki yenilikçi yaklaşımlarıyla tanınmıştır. 2024 yılındaki kuruluşundan itibaren, uzman ekibiyle birlikte müşteri odaklı bir hizmet anlayışını benimseyerek, gelecekte de banket masa sektöründe öncü olma yolunda emin adımlarla ilerlemektedir.',
        image: U('Plastik-Banket-Masa-Saticisi.webp'),
      },
      stats: { items: [
        { value: '', label: 'Teslim edilen ürün' },
        { value: '', label: 'Mutlu müşteri' },
        { value: '', label: 'İhracat yapılan ülke' },
      ] },
      banner: { image: U('Plastik-Banket-Masa-Totem-1920x500.webp'), alt: 'Plastik Banket Masa tabelası' },
      producer: {
        title: 'Üretici olmanın verdiği gururu başarıyla taçlandırıyoruz',
        text: 'Plastik Banket Masa olarak banket masa sektörü içerisinde bir üretici firma olmanın haklı gururunu yaşıyoruz. Üretici olmanın verdiği avantajlar yardımıyla ar-ge süreçlerimizi esnek tutuyor, en iyi ürünü ortaya çıkarıyoruz. Ürünlerimizi yüksek kaliteli materyallerden üretiyor, kullanıcılarımıza eşsiz bir deneyim sunuyoruz.\n\nHer bir masamız, titizlikle seçilmiş en iyi kalitedeki malzemelerle üretilir ve uzman işçilikle işlenir. Plastik Banket Masamız her türlü etkinlik ve organizasyonda şıklık ve prestij sağlar. Müşteri memnuniyetini en üst düzeye çıkarmak için sürekli olarak ürünlerimizi geliştiriyor ve ihtiyaçları karşılamak için özelleştirme seçenekleri sunuyoruz. Müşterilerimize sadece mükemmel ürünler sunmakla kalmayıp aynı zamanda üstün hizmet kalitesiyle de destek oluyoruz.',
        image: U('Plastik-Banket-Masa-Ureticisi.webp'),
      },
    }), 'Hakkımızda', 'Plastik Banket Masa, 2024 yılında güzel İzmir şehrinde kurulmuş ve plastik ürün ve ekipman üretimi alanında uzmanlaşmış bir şirkettir.');

    insPage.run('iletisim', 'iletisim', 'İletişim', JSON.stringify({
      intro: { title: 'İletişime geçelim', text: 'Fiyat teklifi, toptan alım ya da ürünlerimizle ilgili her sorunuz için bize yazın veya arayın.' },
      channels: {
        mail_title: 'E-posta gönderin', mail_text: 'Maillere genellikle birkaç saat içerisinde dönüş yaparız.',
        phone_title: 'Bizi arayın', phone_text: 'Bizi Pazartesi - Cuma 09.00 - 18.00 arası arayabilirsiniz.',
        social_title: 'Bizi takip edin', social_text: 'Hakkımızda daha fazla bilgi edinmek için içeriklerimizi inceleyebilirsiniz.',
      },
      form: { title: 'Mesaj bırakın', text: 'Adınızı ve telefonunuzu bırakmanız yeterli. Size biz dönelim.' },
    }), 'İletişim', 'Plastik Banket Masa iletişim bilgileri: telefon, e-posta ve Bornova / İzmir adresimiz. Fiyat teklifi için hemen yazın.');

    insPage.run('plastik-sandalye', 'plastik-sandalye', 'Plastik Sandalye', JSON.stringify({
      intro: { title: 'Plastik sandalye', text: '%100 yerli üretim plastik sandalyeler ile işinizde ve düğün organizasyonlarınızda en pratik sandalyeleri edinin.' },
    }), 'Plastik Sandalye', '%100 Yerli üretim Plastik Sandalyeler ile işinizde, düğün organizasyonlarınızda en pratik sandalyeleri edinin.');

    insPage.run('blog', 'blog', 'Blog', JSON.stringify({
      intro: { title: 'Blog', text: 'Plastik banket masa, organizasyon ve etkinlik mobilyaları üzerine yazılar.' },
    }), 'Blog', 'Plastik banket masa ve organizasyon mobilyaları üzerine yazılar.');

    insPage.run('legal:kvkk', 'kvkk-aydinlatma-metni', 'KVKK Aydınlatma Metni', JSON.stringify({
      content: { title: 'KVKK Aydınlatma Metni', updated: '7 Kasım 2026', body: legalKvkk() },
    }), 'KVKK Aydınlatma Metni', 'Plastik Banket Masa kişisel verilerin korunması aydınlatma metni.');
    insPage.run('legal:cerez', 'cerez-politikasi', 'Çerez Politikası', JSON.stringify({
      content: { title: 'Çerez Politikası', updated: '7 Kasım 2026', body: legalCerez() },
    }), 'Çerez Politikası', 'plastikbanketmasa.com çerez politikası.');
    insPage.run('legal:kosullar', 'kullanim-kosullari', 'Kullanım Koşulları', JSON.stringify({
      content: { title: 'Kullanım Koşulları', updated: '7 Kasım 2026', body: legalKosullar() },
    }), 'Kullanım Koşulları', 'plastikbanketmasa.com kullanım koşulları.');

    /* ---- ürünler ---- */
    const prodStmt = db.prepare('INSERT INTO products(slug, title, category, sort, data, seo_title, seo_desc) VALUES(?,?,?,?,?,?,?)');
    // Düz yazılan ürün verisini şemadaki bölümlere yerleştirir
    const nest = (o) => ({
      main: { lead: o.lead, summary: o.summary, body: o.body, cover: o.cover, phone: o.phone },
      highlights: { items: o.items, features: o.features, specs: o.specs },
      colors: { items: o.colors },
      gallery: { images: o.images },
      setup: o.setup,
      cta: o.cta,
    });
    const insProd = { run: (slug, title, cat, sort, data, st, sd) => prodStmt.run(slug, title, cat, sort, JSON.stringify(nest(JSON.parse(data))), st, sd) };
    const chairHighlights = [
      { icon: 'sivi', title: 'Üstün sıvı direnci' },
      { icon: 'gunes', title: 'Güneşte sararmaz yapı' },
      { icon: 'depo', title: 'Kolay depolama' },
    ];
    const chairFeatures = [
      { text: 'Güneşte sararmaz gövde malzemesi.' },
      { text: 'Suya karşı maksimum dayanıklılık.' },
      { text: 'Kırılmaya dirençli yapı.' },
    ];

    insProd.run('plastik-banket-masa', 'Plastik Banket Masa', 'masa', 0, JSON.stringify({
      lead: 'Banket masa sektöründe yeni bir çağ başlatıyoruz.',
      summary: 'Türkiye’nin ilk ve tek plastik banket masası. Sıradan banket masalara göre 20 kata kadar uzun ömürlü, kurulumu kolay ve depolaması pratik.',
      body: 'Türkiye’nin ilk ve tek plastik banket masa üreticisi olmanın haklı gururuyla çıktığımız yolculuğumuza yüzlerce referansımızla devam ediyoruz.\n\nDüğün salonları, otel ve organizasyon firmaları için tasarlanan plastik banket masa, kumaş örtü gerektirmeyen temiz yüzeyi, sökülüp takılabilen yapısı ve düşük hacimli kutusuyla hem operasyon süresini hem de maliyeti azaltır.',
      cover: U('PBMPOST-2.webp'),
      phone: '0546 900 09 40',
      items: [
        { icon: 'sivi', title: 'Üstün sıvı direnci' },
        { icon: 'gunes', title: 'Güneşte sararmaz yapı' },
        { icon: 'depo', title: 'Kolay depolama' },
      ],
      features: [
        { text: 'Plastik Banket Masa, yüksek kalite düzeyindeki materyallerden imal edilmektedir.' },
        { text: 'Plastik Banket Masa, sıradan banket masalara göre 20 kata kadar uzun ömürlüdür.' },
        { text: 'Plastik Banket Masa’nın kurulumu oldukça kolaydır, kurulum videomuz yardımıyla kolayca kurulumunu yapabilirsiniz.' },
        { text: 'Plastik Banket Masa, kurulum öncesi sahip olduğu düşük hacim sayesinde kolaylıkla depolanabilir.' },
      ],
      specs: [],
      colors: [],
      images: [U('IMG_7454.webp'), U('IMG_7457-3.webp'), U('IMG_7479-2.webp'), U('Plastik-Banket-Masa-Ust.webp'), U('Plastik-Banket-Masa-Alt.webp'), U('Plastik-Banket-Masa-Kutu-1.webp')],
      setup: {
        title: 'Plastik banket masa nasıl kurulur?',
        image: U('Kurulum-scaled.webp'),
        items: [
          { text: 'Plastik banket masa kurulumu basit olduğu için oldukça hızlı tamamlanabilir.' },
          { text: 'Plastik banket masa kurulumu sıradan banket masalara göre oldukça kolaydır.' },
          { text: 'Plastik banket masa kurulumu ekstra hiçbir maliyet gerektirmez.' },
        ],
        youtube: 'https://youtu.be/wUQcXNif1Xg',
      },
      cta: { text: 'Düğün, konferans ve benzeri etkinliklerinizde maliyetlerinizi ve operasyon sürelerinizi en aza indirmek için hemen şimdi başlayın.', btn_text: 'Satış ekibimizi arayın' },
    }), 'Plastik Banket Masa', 'Türkiye’nin ilk ve tek plastik banket masa üreticisi olmanın haklı gururuyla çıktığımız yolculuğumuza yüzlerce referansımızla devam ediyoruz.');

    insProd.run('katlanir-canta-masa', 'Katlanır Çanta Masa', 'masa', 10, JSON.stringify({
      lead: 'Katlandığında çantaya dönüşen, sağlam ve hafif masa.',
      summary: 'Sağlam plastik yüzey ve güçlü demir ayaklar. Katlanınca 76 x 90 cm, açılınca 76 x 180 cm.',
      body: 'Katlanır Çanta Masa, hem dayanıklılığı hem de pratik kullanımıyla öne çıkan fonksiyonel bir üründür. Sağlam plastik masa yüzeyi ve güçlü demir ayakları sayesinde uzun ömürlü kullanım sunar. Katlandığında çanta formuna dönüşen tasarımı sayesinde kolayca taşınabilir ve minimum yer kaplar.\n\nÜrün, katlanmış halde **76 x 90 cm**, açıldığında ise **76 x 180 cm** ölçülerindedir. Bu sayede hem günlük yaşamda hem de kalabalık buluşmalarda geniş bir kullanım alanı sağlar. Piknik, kamp, bahçe, balkon ya da çeşitli etkinliklerde rahatlıkla kullanılabilen masa, hem hafifliği hem de sağlam yapısıyla her ortamda güvenle tercih edilebilir.',
      cover: U('katlanir-canta-masa-1.jpg'),
      phone: '0506 056 78 23',
      items: chairHighlights,
      features: [],
      specs: [
        { label: 'Katlanmış ölçü', value: '76 x 90 cm' },
        { label: 'Açık ölçü', value: '76 x 180 cm' },
        { label: 'Yüzey', value: 'Plastik' },
        { label: 'Ayaklar', value: 'Demir, katlanır' },
      ],
      colors: [],
      images: [U('plastik-katlanir-canta-masa-banket.jpg'), U('plastik-katlanir-canta-masa.jpg')],
      setup: { title: '', image: '', items: [], youtube: '' },
      cta: { text: 'Toptan ve adetli alımlarda fiyat teklifi için bize ulaşın.', btn_text: '' },
    }), 'Katlanır Çanta Masa', 'Katlanır Çanta Masa, hem dayanıklılığı hem de pratik kullanımıyla öne çıkan fonksiyonel bir üründür. Sağlam plastik masa yüzeyi ve güçlü demir ayakları ile uzun ömürlü.');

    insProd.run('tiffany-dugun-sandalyesi', 'Tiffany Düğün Sandalyesi', 'sandalye', 20, JSON.stringify({
      lead: 'Zarif tasarım, plastiğin dayanıklılığı.',
      summary: 'Düğün ve davetler için zarif tiffany sandalye. Güneşte sararmaz, suya dayanıklı, kırılmaya dirençli.',
      body: 'Tiffany sandalye modelleri, zarif tasarımlarıyla sıradan plastik sandalyelerden ayrılarak öne çıkar. Estetik görünümleri sayesinde benzer işlevlere sahip olsalar da, dekoratif anlamda bir adım öndedirler. Bu sandalyeler, evdeki oturma grupları, çalışma masaları ve kitaplıklarla uyumlu kombinler oluşturabilme özelliği taşır.\n\nFarklı renk seçenekleriyle kullanıcıların beğenisini kazanırken, dayanıklı plastik malzemeleri sayesinde uzun ömürlüdür ve kolay temizlenirler. Plastiğin daha az kir tutan yapısı, Tiffany sandalyeleri basit yöntemlerle temizlemeyi mümkün kılar. Ayrıca, ahşap ve metal sandalyelere kıyasla yağış ve neme karşı daha dirençlidirler.\n\nBalkon ve bahçe gibi dış mekanlarda kullanıma son derece uygundur; ahşap malzemede karşılaşılan mantar, böcek ve kurtçuk gibi sorunlara maruz kalmadıkları için özel bir bakım gerektirmezler.',
      cover: U('19.jpg'),
      phone: '0506 056 78 23',
      items: chairHighlights,
      features: chairFeatures,
      specs: [],
      colors: [],
      images: [U('Tiffany-Dugun-Sandalyesi-1.jpg'), U('Tiffany-Sandalyeler.jpg'), U('Tiffany-Dugun-Sandalyesi-2.jpg'), U('Tiffany-Sandalye.jpg'), U('Tiffany-Sandalye-Ureticisi.jpg')],
      setup: { title: '', image: '', items: [], youtube: '' },
      cta: { text: 'Düğün salonu ve organizasyon firmalarına özel adetli fiyat teklifi alın.', btn_text: '' },
    }), 'Tiffany Düğün Sandalyesi', 'Tiffany sandalye modelleri, zarif tasarımlarıyla sıradan plastik sandalyelerden ayrılarak öne çıkar. Güneşte sararmaz, suya dayanıklı.');

    insProd.run('plastik-kafe-dis-mekan-sandalyeleri', 'Plastik Kafe Dış Mekan Sandalyesi', 'sandalye', 30, JSON.stringify({
      lead: 'Kafe, restoran ve bahçeler için 8 renk seçeneği.',
      summary: 'Hava koşullarına dayanıklı, istiflenebilir, kolay temizlenen dış mekan sandalyesi. 8 farklı renk.',
      body: 'Plastik kafe dış mekan sandalyesi, dayanıklılığı ve pratik kullanımı ile dış mekan oturma alanları için ideal bir tercihtir. Hava koşullarına karşı yüksek direnç gösteren bu sandalyeler, özellikle kafe ve restoran gibi ticari mekanlarda sıkça tercih edilir. Hafif yapıları sayesinde kolayca taşınabilir ve istiflendiğinde yer tasarrufu sağlar.\n\nÇeşitli renk ve tasarım seçenekleri ile dekorasyonunuza uyum sağlayacak bu sandalyeler, rahat oturma alanı sunarak misafirlerinize konforlu bir deneyim yaşatır. Temizliği kolay olan plastik sandalyeler, uzun ömürlü kullanım garantisi ile de ekonomik bir çözüm sunar. Hem estetik hem de fonksiyonel açıdan avantajlar sağlayan plastik kafe dış mekan sandalyeleri, bahçe, teras ve balkon gibi açık alanlarda da mükemmel bir kullanım sunar.',
      cover: U('18.jpg'),
      phone: '0506 056 78 23',
      items: chairHighlights,
      features: chairFeatures,
      specs: [],
      colors: [
        { name: 'Kırmızı', image: U('Kirmizi-Renk-Plastik-Sandalye.jpg') },
        { name: 'Koyu yeşil', image: U('Koyu-YesikRenk-Plastik-Sandalye.jpg') },
        { name: 'Koyu krem', image: U('Krem-Plastik-Sandalye.jpg') },
        { name: 'Lacivert', image: U('Lacivert-Renk-Plastik-Sandalye.jpg') },
        { name: 'Sarı', image: U('Sari-Renk-Plastik-Sandalye.jpg') },
        { name: 'Siyah', image: U('Siyah-Renk-Plastik-Sandalye.jpg') },
        { name: 'Turuncu', image: U('Turuncu-Renk-Plastik-Sandalye.jpg') },
        { name: 'Yeşil', image: U('Yesil-Renk-Plastik-Sandalye.jpg') },
      ],
      images: [U('Plastik-Kafe-Sandalyesi.jpg'), U('Plastik-Kafe-Dis-Mekan-Sandalyesi.jpg'), U('Plastik-Sari-Dis-Mekan-Sandalyesi.jpg'), U('plastik-ic-dis-mekan-sandalye-1.jpg'), U('Plastik-Bahce-Kafe-Sandalyesi.jpg'), U('Plastik-Kafe-Sandalyesi-1.jpg'), U('Plastik-Organizayon-Sandalyeleri.jpg'), U('Plastik-Sandalye.jpg')],
      setup: { title: '', image: '', items: [], youtube: '' },
      cta: { text: 'Renk ve adet bilgisini iletin, size fiyat teklifiyle dönelim.', btn_text: '' },
    }), 'Plastik Kafe Dış Mekan Sandalyeleri', 'Plastik Banket Masa’nın satışını gerçekleştirdiği plastik kafe dış mekan sandalyeleri yüksek kaliteli malzemelerden imal edilmektedir.');

    /* ---- blog ---- */
    const cat = db.prepare('INSERT INTO categories(name, slug, description) VALUES(?,?,?)').run('Banket Masa', 'banket-masa', 'Plastik banket masa kullanımı, kurulumu ve avantajları üzerine yazılar.');
    db.prepare(`INSERT INTO posts(slug, title, excerpt, body, cover, category_id, status, published_at, seo_desc) VALUES(?,?,?,?,?,?,?,?,?)`).run(
      'plastik-banket-masanin-avantajlari-nelerdir',
      'Plastik Banket Masa’nın Avantajları Nelerdir?',
      'Plastik banket masaları, çeşitli etkinliklerde kullanılan ve bir dizi avantaj sunan pratik ve çok yönlü mobilyalardır.',
      blogBody(U), U('Plastik-Banket-Masa-Ust.webp'), cat.lastInsertRowid, 'published', '2024-03-11 17:17:23',
      'Plastik banket masaları, çeşitli etkinliklerde kullanılan ve bir dizi avantaj sunan pratik ve çok yönlü mobilyalardır. İşte plastik banket masalarının avantajları.'
    );

    /* ---- menüler ---- */
    const insMenu = db.prepare('INSERT INTO menus(key, label, description, items) VALUES(?,?,?,?)');
    insMenu.run('header', 'Header menüsü', 'Sitenin üstündeki ana menü ve mobil menü', JSON.stringify([
      { label: 'Ana Sayfa', url: '/', level: 0 },
      { label: 'Ürünler', url: '/plastik-banket-masa', level: 0 },
      { label: 'Plastik Banket Masa', url: '/plastik-banket-masa', level: 1 },
      { label: 'Katlanır Çanta Masa', url: '/katlanir-canta-masa', level: 1 },
      { label: 'Tiffany Düğün Sandalyesi', url: '/tiffany-dugun-sandalyesi', level: 1 },
      { label: 'Plastik Kafe Dış Mekan Sandalyesi', url: '/plastik-kafe-dis-mekan-sandalyeleri', level: 1 },
      { label: 'Hakkımızda', url: '/hakkimizda', level: 0 },
      { label: 'Blog', url: '/blog', level: 0 },
      { label: 'İletişim', url: '/iletisim', level: 0 },
    ]));
    insMenu.run('footer_products', 'Footer: Ürünler', 'Footer’daki ürünler kolonu', JSON.stringify([
      { label: 'Plastik Banket Masa', url: '/plastik-banket-masa' },
      { label: 'Katlanır Çanta Masa', url: '/katlanir-canta-masa' },
      { label: 'Plastik Sandalye', url: '/plastik-sandalye' },
      { label: 'Tiffany Düğün Sandalyesi', url: '/tiffany-dugun-sandalyesi' },
      { label: 'Plastik Kafe Dış Mekan Sandalyesi', url: '/plastik-kafe-dis-mekan-sandalyeleri' },
    ]));
    insMenu.run('footer_company', 'Footer: Kurumsal', 'Footer’daki kurumsal kolon', JSON.stringify([
      { label: 'Hakkımızda', url: '/hakkimizda' },
      { label: 'Blog', url: '/blog' },
      { label: 'İletişim', url: '/iletisim' },
    ]));
    insMenu.run('legal', 'Yasal bağlantılar', 'Footer alt şeridindeki KVKK, çerez ve koşullar bağlantıları', JSON.stringify([
      { label: 'KVKK Aydınlatma Metni', url: '/kvkk-aydinlatma-metni' },
      { label: 'Çerez Politikası', url: '/cerez-politikasi' },
      { label: 'Kullanım Koşulları', url: '/kullanim-kosullari' },
    ]));
  });
  tx();
  logActivity(null, 'İlk kurulum tamamlandı', 'Site içeriği yüklendi');
  console.log('[seed] Tamamlandı.');
}

module.exports = { seed };

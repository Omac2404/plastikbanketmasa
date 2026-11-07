'use strict';
/**
 * Panelde düzenlenebilen alanların tanımı.
 * Her sayfa bölümlerden, her bölüm alanlardan oluşur. Panel formu buradan üretilir.
 *
 * Alan türleri:
 *  text, textarea, markdown, image, url, number, toggle, select(options),
 *  list (fields: [...]) -> tekrarlanan maddeler, gallery -> görsel listesi
 */

const HIGHLIGHT_ICONS = [
  ['sivi', 'Sıvı direnci'],
  ['gunes', 'Güneşe dayanım'],
  ['depo', 'Kolay depolama'],
  ['kirilma', 'Kırılmaya direnç'],
  ['hafif', 'Hafiflik'],
  ['kurulum', 'Kolay kurulum'],
  ['olcu', 'Ölçü'],
  ['kalite', 'Kalite'],
];

const pageSchemas = {
  home: {
    label: 'Ana Sayfa',
    sections: [
      { key: 'hero', label: 'Banner', fields: [
        { key: 'title', label: 'Başlık', type: 'textarea', rows: 2, help: 'Turuncu görünmesini istediğiniz kısmı **iki yıldız** arasına alın.' },
        { key: 'text', label: 'Alt metin', type: 'textarea', rows: 3 },
        { key: 'image', label: 'Banner görseli', type: 'image', help: 'Yatay, en az 1600 px genişlikte bir fotoğraf.' },
        { key: 'image_alt', label: 'Görselin açıklaması', type: 'text', help: 'Görme engelli ziyaretçiler ve Google için kısa açıklama.' },
        { key: 'btn_text', label: 'Birinci buton metni', type: 'text' },
        { key: 'btn_url', label: 'Birinci buton adresi', type: 'url' },
        { key: 'btn2_text', label: 'İkinci buton metni', type: 'text' },
        { key: 'btn2_url', label: 'İkinci buton adresi', type: 'url' },
      ] },
      { key: 'values', label: 'Bizi biz yapanlar', fields: [
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'image', label: 'Yan görsel', type: 'image' },
        { key: 'items', label: 'Maddeler', type: 'list', hint: 'En iyi görünüm 3 madde', fields: [
          { key: 'title', label: 'Başlık', type: 'text' },
          { key: 'text', label: 'Açıklama', type: 'textarea', rows: 2 },
        ] },
      ] },
      { key: 'producer', label: 'Üretici olmanın gururu', fields: [
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'text', label: 'Metin', type: 'textarea', rows: 5, help: 'Boş satır bırakarak paragraf ayırın.' },
        { key: 'image1', label: 'Görsel 1', type: 'image' },
        { key: 'image2', label: 'Görsel 2', type: 'image' },
        { key: 'btn_text', label: 'Buton metni', type: 'text' },
        { key: 'btn_url', label: 'Buton adresi', type: 'url' },
      ] },
      { key: 'products', label: 'Ürünler bölümü', fields: [
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'text', label: 'Kısa açıklama', type: 'textarea', rows: 2, help: 'Ürünler panelin "Ürünler" bölümünden otomatik gelir.' },
      ] },
      { key: 'quality', label: 'Kalite politikası', fields: [
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'text', label: 'Metin', type: 'textarea', rows: 5 },
        { key: 'btn_text', label: 'Buton metni', type: 'text' },
        { key: 'btn_url', label: 'Buton adresi', type: 'url' },
      ] },
      { key: 'video', label: 'Kurulum videosu', fields: [
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'text', label: 'Açıklama', type: 'textarea', rows: 2 },
        { key: 'steps', label: 'Kurulum adımları', type: 'list', fields: [{ key: 'text', label: 'Adım', type: 'text' }] },
        { key: 'youtube', label: 'YouTube adresi', type: 'url', help: 'Örn: https://youtu.be/wUQcXNif1Xg' },
        { key: 'poster', label: 'Kapak görseli', type: 'image', help: 'Boş bırakılırsa YouTube kapağı kullanılır.' },
      ] },
      { key: 'stats', label: 'Rakamlar', fields: [
        { key: 'items', label: 'Rakamlar', type: 'list', hint: 'Rakam alanı boş olan madde sitede gösterilmez.', fields: [
          { key: 'value', label: 'Rakam', type: 'text', help: 'Örn: 12.000+' },
          { key: 'label', label: 'Açıklama', type: 'text' },
        ] },
      ] },
      { key: 'shipping', label: 'Düşük taşıma maliyeti', fields: [
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'text', label: 'Metin', type: 'textarea', rows: 4 },
        { key: 'image', label: 'Görsel', type: 'image' },
        { key: 'btn_text', label: 'Buton metni', type: 'text' },
        { key: 'btn_url', label: 'Buton adresi', type: 'url' },
      ] },
      { key: 'contact', label: 'İletişim bölümü', fields: [
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'text', label: 'Açıklama', type: 'textarea', rows: 2 },
      ] },
    ],
  },

  hakkimizda: {
    label: 'Hakkımızda',
    sections: [
      { key: 'intro', label: 'Giriş', fields: [
        { key: 'title', label: 'Sayfa başlığı', type: 'text' },
        { key: 'lead', label: 'Alt başlık', type: 'text' },
        { key: 'text', label: 'Metin', type: 'textarea', rows: 10, help: 'Boş satır bırakarak paragraf ayırın.' },
        { key: 'image', label: 'Görsel', type: 'image' },
      ] },
      { key: 'stats', label: 'Rakamlar', fields: [
        { key: 'items', label: 'Rakamlar', type: 'list', hint: 'Rakam alanı boş olan madde sitede gösterilmez.', fields: [
          { key: 'value', label: 'Rakam', type: 'text' },
          { key: 'label', label: 'Açıklama', type: 'text' },
        ] },
      ] },
      { key: 'banner', label: 'Geniş görsel', fields: [
        { key: 'image', label: 'Görsel', type: 'image', help: 'Geniş ve yatay (örn. 1920×500).' },
        { key: 'alt', label: 'Görselin açıklaması', type: 'text' },
      ] },
      { key: 'producer', label: 'Üretici olmak', fields: [
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'text', label: 'Metin', type: 'textarea', rows: 8 },
        { key: 'image', label: 'Görsel', type: 'image' },
      ] },
    ],
  },

  iletisim: {
    label: 'İletişim',
    sections: [
      { key: 'intro', label: 'Giriş', fields: [
        { key: 'title', label: 'Sayfa başlığı', type: 'text' },
        { key: 'text', label: 'Açıklama', type: 'textarea', rows: 2 },
      ] },
      { key: 'channels', label: 'İletişim kutuları', fields: [
        { key: 'mail_title', label: 'E-posta başlığı', type: 'text' },
        { key: 'mail_text', label: 'E-posta açıklaması', type: 'text' },
        { key: 'phone_title', label: 'Telefon başlığı', type: 'text' },
        { key: 'phone_text', label: 'Telefon açıklaması', type: 'text' },
        { key: 'social_title', label: 'Sosyal medya başlığı', type: 'text' },
        { key: 'social_text', label: 'Sosyal medya açıklaması', type: 'text' },
      ] },
      { key: 'form', label: 'Form', fields: [
        { key: 'title', label: 'Form başlığı', type: 'text' },
        { key: 'text', label: 'Form açıklaması', type: 'textarea', rows: 2 },
      ] },
    ],
  },

  'plastik-sandalye': {
    label: 'Plastik Sandalye (liste)',
    sections: [
      { key: 'intro', label: 'Giriş', fields: [
        { key: 'title', label: 'Sayfa başlığı', type: 'text' },
        { key: 'text', label: 'Açıklama', type: 'textarea', rows: 3, help: 'Sayfada "Sandalye" kategorisindeki ürünler otomatik listelenir.' },
      ] },
    ],
  },

  blog: {
    label: 'Blog',
    sections: [
      { key: 'intro', label: 'Giriş', fields: [
        { key: 'title', label: 'Sayfa başlığı', type: 'text' },
        { key: 'text', label: 'Açıklama', type: 'textarea', rows: 2 },
      ] },
    ],
  },

  legal: {
    label: 'Yasal metin',
    sections: [
      { key: 'content', label: 'İçerik', fields: [
        { key: 'title', label: 'Sayfa başlığı', type: 'text' },
        { key: 'updated', label: 'Son güncelleme tarihi', type: 'text', help: 'Örn: 7 Kasım 2026' },
        { key: 'body', label: 'Metin', type: 'markdown', rows: 22 },
      ] },
    ],
  },
};

/** Her sayfada görünen ortak alanlar (Header, Footer, iletişim bilgileri) */
const globalSchema = {
  label: 'Ortak alanlar',
  sections: [
    { key: 'contact', label: 'İletişim bilgileri', fields: [
      { key: 'phone', label: 'Ana telefon', type: 'text', help: 'Üst şerit, footer ve iletişim sayfasında görünür.' },
      { key: 'phone_sales', label: 'Satış hattı (Şimdi Ara butonları)', type: 'text', help: 'Boşsa ana telefon kullanılır. Ürün bazında ayrıca değiştirilebilir.' },
      { key: 'whatsapp', label: 'WhatsApp numarası', type: 'text' },
      { key: 'whatsapp_text', label: 'WhatsApp hazır mesaj', type: 'text' },
      { key: 'email', label: 'E-posta', type: 'text' },
      { key: 'address', label: 'Adres', type: 'textarea', rows: 2 },
      { key: 'hours', label: 'Çalışma saatleri', type: 'text' },
      { key: 'map_embed', label: 'Google Haritalar yerleştirme adresi', type: 'url', help: 'Google Haritalar > Paylaş > Harita yerleştir > iframe içindeki src adresi.' },
      { key: 'map_link', label: 'Google Haritalar bağlantısı', type: 'url', help: 'Yol tarifi butonu bu adrese gider.' },
    ] },
    { key: 'social', label: 'Sosyal medya', fields: [
      { key: 'instagram', label: 'Instagram', type: 'url' },
      { key: 'facebook', label: 'Facebook', type: 'url' },
      { key: 'linkedin', label: 'LinkedIn', type: 'url' },
      { key: 'youtube', label: 'YouTube', type: 'url' },
    ] },
    { key: 'header', label: 'Header', fields: [
      { key: 'logo', label: 'Logo', type: 'image' },
      { key: 'cta_text', label: 'Sağ üst buton metni', type: 'text' },
      { key: 'cta_url', label: 'Sağ üst buton adresi', type: 'url', help: 'Boşsa satış hattını arar.' },
    ] },
    { key: 'footer', label: 'Footer', fields: [
      { key: 'logo', label: 'Açık renk logo', type: 'image' },
      { key: 'about', label: 'Kısa tanıtım', type: 'textarea', rows: 3 },
      { key: 'company', label: 'Ticari unvan', type: 'text', help: 'Telif satırında görünür.' },
    ] },
  ],
};

const productSchema = {
  sections: [
    { key: 'main', label: 'Ürün bilgisi', fields: [
      { key: 'lead', label: 'Öne çıkan cümle', type: 'text', help: 'Ürün sayfasında başlığın altında büyük yazılır.' },
      { key: 'summary', label: 'Kısa açıklama', type: 'textarea', rows: 3, help: 'Ürün kartlarında ve arama sonuçlarında görünür.' },
      { key: 'body', label: 'Detaylı açıklama', type: 'markdown', rows: 10 },
      { key: 'cover', label: 'Kapak görseli', type: 'image' },
      { key: 'phone', label: 'Bu ürün için telefon', type: 'text', help: 'Boşsa genel satış hattı kullanılır.' },
    ] },
    { key: 'highlights', label: 'Öne çıkan özellikler', fields: [
      { key: 'items', label: 'Özellikler', type: 'list', hint: '3 madde idealdir', fields: [
        { key: 'icon', label: 'Simge', type: 'select', options: HIGHLIGHT_ICONS },
        { key: 'title', label: 'Başlık', type: 'text' },
      ] },
      { key: 'features', label: 'Madde madde avantajlar', type: 'list', fields: [
        { key: 'text', label: 'Madde', type: 'text' },
      ] },
      { key: 'specs', label: 'Teknik bilgiler', type: 'list', fields: [
        { key: 'label', label: 'Özellik', type: 'text' },
        { key: 'value', label: 'Değer', type: 'text' },
      ] },
    ] },
    { key: 'colors', label: 'Renk seçenekleri', fields: [
      { key: 'items', label: 'Renkler', type: 'list', fields: [
        { key: 'name', label: 'Renk adı', type: 'text' },
        { key: 'image', label: 'Görsel', type: 'image' },
      ] },
    ] },
    { key: 'gallery', label: 'Galeri', fields: [
      { key: 'images', label: 'Görseller', type: 'gallery' },
    ] },
    { key: 'setup', label: 'Kurulum', fields: [
      { key: 'title', label: 'Başlık', type: 'text' },
      { key: 'image', label: 'Kurulum görseli', type: 'image' },
      { key: 'items', label: 'Maddeler', type: 'list', fields: [{ key: 'text', label: 'Madde', type: 'text' }] },
      { key: 'youtube', label: 'Kurulum videosu (YouTube)', type: 'url' },
    ] },
    { key: 'cta', label: 'Sayfa sonu çağrısı', fields: [
      { key: 'text', label: 'Metin', type: 'textarea', rows: 2 },
      { key: 'btn_text', label: 'Buton metni', type: 'text' },
    ] },
  ],
};

const PRODUCT_CATEGORIES = [['masa', 'Masa'], ['sandalye', 'Sandalye']];

module.exports = { pageSchemas, globalSchema, productSchema, HIGHLIGHT_ICONS, PRODUCT_CATEGORIES };

/* =====================================================================
   content.js — renk şemaları ve Türkçe öğretici içerik
   ===================================================================== */
(function (root) {
  'use strict';

  var PALETTES = {
    klasik: { beyaz: '#f3f5fa', sari: '#f0c400', kirmizi: '#cf2436', turuncu: '#f07217', yesil: '#0f9c56', mavi: '#1259c3' },
    canli:  { beyaz: '#ffffff', sari: '#ffd60a', kirmizi: '#ff3b30', turuncu: '#ff9f0a', yesil: '#30d158', mavi: '#0a84ff' },
    pastel: { beyaz: '#f6f4ef', sari: '#ffe08a', kirmizi: '#ff8f8f', turuncu: '#ffbe7d', yesil: '#8fdcae', mavi: '#8fbcff' },
    neon:   { beyaz: '#eafcff', sari: '#f9f871', kirmizi: '#ff2d78', turuncu: '#ff8a3d', yesil: '#2bff88', mavi: '#3d8bff' }
  };

  var COLOR_NAMES = {
    beyaz: 'Beyaz', sari: 'Sarı', kirmizi: 'Kırmızı',
    turuncu: 'Turuncu', yesil: 'Yeşil', mavi: 'Mavi'
  };

  /* Küpü "beyaz altta, yeşil önde" tutan standart dizilim */
  var DEFAULT_SCHEME = { U: 'sari', R: 'turuncu', F: 'yesil', D: 'beyaz', L: 'kirmizi', B: 'mavi' };

  var FACE_NAMES = {
    U: { tr: 'Üst', long: 'Üst yüz (yukarı bakan)' },
    R: { tr: 'Sağ', long: 'Sağ yüz' },
    F: { tr: 'Ön', long: 'Ön yüz (sana bakan)' },
    D: { tr: 'Alt', long: 'Alt yüz (aşağı bakan)' },
    L: { tr: 'Sol', long: 'Sol yüz' },
    B: { tr: 'Arka', long: 'Arka yüz' }
  };

  /* Notasyon kartları */
  var NOTATION = [];
  ['U', 'R', 'F', 'D', 'L', 'B'].forEach(function (f) {
    var n = FACE_NAMES[f].tr;
    NOTATION.push({ move: f, title: n, desc: n + ' yüzü, o yüze bakarken saat yönünde çeyrek tur.' });
    NOTATION.push({ move: f + "'", title: n + ' ters', desc: n + ' yüzü, saat yönünün tersine çeyrek tur. Okunuşu: "' + n.toLowerCase() + ' üs".' });
    NOTATION.push({ move: f + '2', title: n + ' çift', desc: n + ' yüzü yarım tur (180°). Yönü önemli değil.' });
  });

  /* Yöntem aşamaları — çözücünün izlediği yol */
  var METHOD = [
    {
      title: 'Alt artı',
      body: 'Alt yüzün merkez rengiyle aynı olan 4 kenar parçasını alt yüze taşı. Yalnızca alt yüzde aynı renk olması yetmez; ' +
            'kenarın yandaki rengi de komşu merkezle aynı olmalı.',
      goal: 'Alt yüzde artı, yan renkler merkezlerle hizalı.'
    },
    {
      title: 'Alt köşeler',
      body: 'Her köşeyi üst katmanda kendi yuvasının tam üstüne getir, sonra sağ el (R U R\') ya da sol el (F\' U\' F) ' +
            'hareketiyle aşağı indir. Köşe yanlış dönmüşse aynı hareketi tekrarla.',
      goal: 'İlk katman tamam: alt yüz tek renk, yan şeritler eşleşmiş.'
    },
    {
      title: 'Orta katman',
      body: 'Üst katmanda üzerinde alt yüz rengi olmayan kenarları bul. Kenarı hedef yuvasının yanına getirip ' +
            'sağa (U R U\' R\' U\' F\' U F) veya sola (U\' F\' U F U R U\' R\') ekleme hareketini uygula.',
      goal: 'Alt iki katman tamam.'
    },
    {
      title: 'Üst artı',
      body: 'Üst yüzde nokta, çizgi ya da L şekli görürsün. F R U R\' U\' F\' hareketi sırayla nokta → L → çizgi → artı ' +
            'yolunu izler. Bu adımda yalnızca kenarların yönü önemli.',
      goal: 'Üst yüzde artı şekli.'
    },
    {
      title: 'Üst yüzü tamamla',
      body: 'Sune (R U R\' U R U2 R\') hareketi üç köşeyi çevirir. Doğru köşeyi sağ-ön üstte tutup gereken kadar tekrarla; ' +
            'üst yüz tek renk olana dek sürer.',
      goal: 'Üst yüz tamamen tek renk.'
    },
    {
      title: 'Köşeleri yerleştir',
      body: 'Üst köşeleri kendi köşelerine taşı. A-perm üç köşeyi döndürür; iki köşenin takas edilmesi gerekiyorsa ' +
            'T-perm veya Y-perm kullanılır. Köşelerin yönü bozulmaz.',
      goal: 'Üst köşeler doğru köşelerde.'
    },
    {
      title: 'Kenarları yerleştir',
      body: 'Son iş üst kenarları yerine taşımak. U-perm üç kenarı döndürür, H-perm karşılıklı çiftleri takas eder. ' +
            'Bu adım bitince küp çözülür.',
      goal: 'Küp çözüldü.'
    }
  ];

  /* Ezberlenecek asgari algoritma seti */
  var ALG_CARDS = [
    { name: 'Sağ el', alg: "R U R'", when: 'Alt köşeyi yuvasına indirmenin temel yolu. Üst katmandaki köşe sağ-ön üstteyken.' },
    { name: 'Sol el', alg: "F' U' F", when: 'Sağ elin aynası. Köşe ön yüzden inecekse.' },
    { name: 'Orta katman: sağa ekleme', alg: "U R U' R' U' F' U F", when: 'Kenarı ön-sağ yuvaya sokar.' },
    { name: 'Orta katman: sola ekleme', alg: "U' F' U F U R U' R'", when: 'Kenarı ön-sol yuvaya sokar.' },
    { name: 'Üst artı', alg: "F R U R' U' F'", when: 'Üst kenarların yönünü düzeltir: nokta → L → çizgi → artı.' },
    { name: 'Sune', alg: "R U R' U R U2 R'", when: 'Üst köşeleri çevirir. Üst yüzü tek renk yapana dek tekrar.' },
    { name: 'Anti-Sune', alg: "R U2 R' U' R U' R'", when: 'Sune’nin ters yönü. Bazı durumlarda daha kısa yol.' },
    { name: 'A-perm', alg: "R' F R' B2 R F' R' B2 R2", when: 'Üç üst köşeyi yer değiştirir, yönleri bozmaz.' },
    { name: 'T-perm', alg: "R U R' U' R' F R2 U' R' U' R U R' F'", when: 'Komşu iki köşeyi ve iki kenarı takas eder.' },
    { name: 'Y-perm', alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'", when: 'Çapraz iki köşeyi takas eder.' },
    { name: 'U-perm', alg: "R U' R U R U R U' R' U' R2", when: 'Üç üst kenarı döndürür.' },
    { name: 'H-perm', alg: "R2 U2 R U2 R2 U2 R2 U2 R U2 R2", when: 'Karşılıklı kenar çiftlerini takas eder.' }
  ];

  root.Content = {
    PALETTES: PALETTES,
    COLOR_NAMES: COLOR_NAMES,
    DEFAULT_SCHEME: DEFAULT_SCHEME,
    FACE_NAMES: FACE_NAMES,
    NOTATION: NOTATION,
    METHOD: METHOD,
    ALG_CARDS: ALG_CARDS
  };
})(window);

# Rubrik

3×3 Rubik küpü oyunu ve **gerçek küp için adım adım çözüm yardımcısı**.
Bağımlılığı yok: statik HTML/CSS/JS, nginx ile servis edilir. Tüm hesaplama tarayıcıda yapılır.

Yayın adresi: https://rubrik.perinet.org

## Bölümler

| Bölüm | Ne yapar |
|---|---|
| **Oyna** | 3B küp; fare sol tuşuyla kareyi sürükle (katman döndür), sağ tuşla sürükle (görünümü çevir), dokunmatikte kare sürükle / boşluk sürükle; klavye notasyonu, karıştırma, kronometre (15 sn inceleme, ao5/ao12, rekorlar), ipucu ve otomatik çözüm |
| **Küpümü Çöz** | Küpün renklerini 2B açılıma gir → girerken canlı denetim (her renkten en çok 9 kare, her kenar/köşe gerçek bir parçaya uymak zorunda, aynı parça iki kez girilemez) → hamle hamle çözüm rehberi (3B önizleme, aşama haritası, yazdırma) |
| **Öğren** | Notasyon kartları, katman katman yöntemin yedi aşaması, ezberlenecek asgari algoritma seti |

## Dizin

```text
rubrik/
├── nginx.conf              # konteyner içi sunucu yapılandırması
├── test/run.js             # motor ve çözücü testleri (bağımlılıksız)
├── tools/make-assets.py    # kapak ve PWA ikonlarını üretir (Pillow)
└── www/
    ├── index.html
    ├── css/app.css
    ├── img/                # kapak, ikonlar, favicon
    └── js/
        ├── cube.js         # küp mantığı: kübik gösterim, hareketler, facelet dönüşümü, doğrulama
        ├── geometry.js     # uzamsal model: 26 parça, konum + yönelim matrisi
        ├── solver.js       # katman katman çözücü, açıklamalı adımlar üretir
        ├── scene.js        # CSS 3B görüntüleyici (kütüphane yok)
        ├── content.js      # renk şemaları ve Türkçe öğretici içerik
        └── app.js          # arayüz: oyna / çöz / öğren
```

## Çözücü

Başlangıç (katman katman) yöntemini uygular; çıktısı insanın takip edebileceği,
aşamalara bölünmüş ve açıklamalı hamle dizisidir.

1. **Alt artı** — 4 alt kenar için indirgenmiş durum uzayında (24⁴ = 331.776 durum) BFS mesafe
   tablosu kurulur, çözüm bu tablonun gradyanı izlenerek en kısa yoldan üretilir.
2. **Alt köşeler / orta katman** — parça parça, insan algoritmalarından oluşan bir havuzda
   genişlik öncelikli arama. Hedef testi, daha önce yerleşen parçaların bozulmamasını şart koşar.
3. **Üst artı → üst yüz → köşeler → kenarlar** — aynı arama motoru; havuzlar sırasıyla
   `F R U R' U' F'`, Sune/Anti-Sune, A/T/Y-perm ve U/H-perm algoritmalarından oluşur.

T-perm ve Y-perm havuzda olduğu için **parite durumları** (iki köşe + iki kenarın takas edilmesi
gerektiği hâller) da çözülür. Bitişte adım sınırlarındaki aynı yüz hareketleri sadeleştirilir.

Ortalama 103 hamle, tipik hesaplama süresi 50 ms (en kötü ~0,5 sn).

## Testler

```bash
cd /opt/oyunlar/rubrik
node test/run.js          # 2000 rastgele küp (varsayılan)
node test/run.js 15000    # daha geniş tarama
```

Kapsam:

* Kübik gösterim ile bağımsız uzamsal modelin 18 hareket ve 300 rastgele dizide birebir
  aynı sonucu verdiği (iki ayrı uygulamanın çapraz denetimi)
* Grup özellikleri: her hareketin mertebesi 4, `(R U R' U')⁶ = birim`, süperflip, ters alg,
  sadeleştirmenin durumu değiştirmemesi
* Facelet dönüşümlerinin gidiş-dönüş tutarlılığı ve geçersiz küplerin (köşe çevrilmesi,
  kenar ters dönmesi, parite, renk sayısı, eksik boyama) reddedilmesi
* Rastgele küplerde çözücü: üretilen dizinin küpü gerçekten çözmesi, adım zincirlerinin
  (`before` + hamleler = `after`) tutarlılığı, aşama bilgisi
* Sınır durumları: çözülmüş küp, tek hamlelik küpler, süperflip, parite durumu

15.000 rastgele küpün tamamı doğrulanmıştır.

Arayüz tarafı için ayrıca `test/ui.js` vardır; jsdom gerektirdiği için isteğe bağlıdır:

```bash
mkdir -p /tmp/rubrik-ui && cd /tmp/rubrik-ui && npm init -y && npm i jsdom
NODE_PATH=/tmp/rubrik-ui/node_modules node /opt/oyunlar/rubrik/test/ui.js
```

Açılıştan çözüm rehberinin sonuna kadar 54 denetim yapar; rehberdeki hamleler tek tek
yürütülüp 3B küpün gerçekten çözüldüğü DOM üzerinden doğrulanır.

## Görselleri yeniden üretme

```bash
python3 tools/make-assets.py     # Pillow gerektirir
```

## Yayın

```bash
cd /opt/oyunlar
docker compose up -d rubrik
```

Konteyner: `rubrik-web`, ağ `npm-net`, iç port `80`.
Nginx Proxy Manager hedefi: `rubrik-web:80`.

'use strict';

async function buildReportHTML(originalBuffer, origDataURL, onProgress) {
  const orig = originalBuffer;
  const W = orig.width, H = orig.height;
  const items = [];

  const tGlobal = document.getElementById('globalThreshold') ? +document.getElementById('globalThreshold').value : 128;
  const tWin = document.getElementById('windowSize') ? +document.getElementById('windowSize').value : 25;
  const tK = document.getElementById('sauvolaK') ? +document.getElementById('sauvolaK').value / 100 : 0.2;
  const edgeMode = document.getElementById('edgeMode') ? document.getElementById('edgeMode').value : 'reflect';

  const recipes = [
    { name: 'Линейное контрастирование',   fn: b => linearContrast(b, 0.02, 0.98) },
    { name: 'Эквализация RGB',             fn: b => equalizeRGB(b) },
    { name: 'Эквализация HSV (V-канал)',   fn: b => equalizeHSV(b) },
    { name: 'CLAHE (8×8, clip=40)',        fn: b => clahe(b, 8, 40) },
    
    { name: `Фиксированный порог ${tGlobal}`, fn: b => grayToBuffer(binarize(b.toGray(), tGlobal), W, H) },
    { name: 'Отсу',                        fn: b => grayToBuffer(binarize(b.toGray(), otsuThreshold(b.toGray())), W, H) },
    { name: `Sauvola (win=${tWin}, k=${tK})`, fn: b => grayToBuffer(sauvolaThreshold(b.toGray(), W, H, tWin, tK), W, H) },
    { name: `Wolf (win=${tWin}, k=${tK})`,    fn: b => grayToBuffer(wolfThreshold(b.toGray(), W, H, tWin, tK), W, H) },
    
    { name: `Гаусс σ=1.5 (${edgeMode})`,   fn: b => separableConvolveBuffer(b, gaussianKernel1D(1.5), edgeMode) },
    { name: `Box r=2 (${edgeMode})`,       fn: b => separableConvolveBuffer(b, boxKernel1D(2), edgeMode) },
    { name: `Unsharp (σ=1.5, α=1.0)`,      fn: b => unsharpMask(b, 1.5, 1.0, edgeMode) },
    { name: 'Лапласиан',                   fn: b => laplacianSharpen(b, edgeMode) },
    
    { name: 'Медиана r=1',                 fn: b => medianFilterBuffer(b, 1, edgeMode) },
    { name: 'Sobel (модуль)',              fn: b => grayToBuffer(visualizeMagnitude(sobel(b.toGray(), W, H, edgeMode).mag), W, H) },
    { name: 'Sobel + направления',         fn: b => { const { mag, dir } = sobel(b.toGray(), W, H, edgeMode); return visualizeDirection(dir, mag, W, H); } },
    { name: 'Canny (субпиксельный)',       fn: b => grayToBuffer(canny(b.toGray(), W, H, { sigma: 1.4, lowT: 0.08, highT: 0.20, mode: edgeMode }).binary, W, H) },
    
    { name: 'Морф. градиент (крест 3)',    fn: b => grayToBuffer(morphComposite(b.toGray(), W, H, makeStructElement('cross', 3), 'gradient', edgeMode), W, H) },
    { name: 'Top-Hat (крест 5)',           fn: b => grayToBuffer(morphComposite(b.toGray(), W, H, makeStructElement('cross', 5), 'tophat', edgeMode), W, H) },
    { name: 'Black-Hat (крест 5)',         fn: b => grayToBuffer(morphComposite(b.toGray(), W, H, makeStructElement('cross', 5), 'blackhat', edgeMode), W, H) },
  ];

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    if (onProgress) onProgress(i / recipes.length);
    await new Promise(res => setTimeout(res, 0));
    try {
      const res = r.fn(orig);
      items.push({
        name: r.name,
        origStats: stats(orig.toGray()),
        resStats: stats(res.toGray()),
        origData: origDataURL,
        resData: bufferToDataURL(res),
      });
    } catch (e) { console.error('Ошибка в отчёте для метода ' + r.name + ':', e); }
  }
  if (onProgress) onProgress(1);
  return renderReportHTML(items);
}

function bufferToDataURL(buf) {
  const c = document.createElement('canvas');
  c.width = buf.width; c.height = buf.height;
  c.getContext('2d').putImageData(buf.toImageData(), 0, 0);
  return c.toDataURL('image/png');
}

function renderReportHTML(items) {
  const rows = items.map(it => `
    <div class="item">
      <h2>${escapeHtml(it.name)}</h2>
      <div class="pair">
        <figure><figcaption>До</figcaption><img src="${it.origData}"></figure>
        <figure><figcaption>После</figcaption><img src="${it.resData}"></figure>
      </div>
      <table>
        <tr><th></th><th>Среднее</th><th>σ</th><th>Энтропия</th></tr>
        <tr><td>До</td><td>${it.origStats.mean.toFixed(2)}</td><td>${it.origStats.std.toFixed(2)}</td><td>${it.origStats.entropy.toFixed(3)}</td></tr>
        <tr><td>После</td><td>${it.resStats.mean.toFixed(2)}</td><td>${it.resStats.std.toFixed(2)}</td><td>${it.resStats.entropy.toFixed(3)}</td></tr>
      </table>
    </div>
  `).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Отчёт ЛР №3</title>
<style>
  body{font-family:system-ui,Arial;background:#1a1a1a;color:#e5e5e5;padding:24px;max-width:1100px;margin:0 auto;}
  h1{text-align:center;}
  .item{background:#2a2a2a;border:1px solid #3a3a3a;border-radius:12px;padding:16px;margin-bottom:16px;}
  .pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  figure{margin:0;text-align:center;}
  figcaption{font-size:12px;color:#9a9a9a;margin-bottom:4px;}
  img{max-width:100%;background:#111;border-radius:8px;}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px;}
  th,td{padding:6px;border-bottom:1px solid #3a3a3a;text-align:left;}
  th{color:#9a9a9a;font-weight:500;}
  h2{font-size:15px;margin:0 0 12px 0;}
</style></head><body>
<h1>Аналитический отчёт по ЛР №3</h1>
<p style="text-align:center;color:#9a9a9a;font-size:13px">
  Сравнение алгоритмов: изображения «до/после», статистика яркости и энтропия.
</p>
${rows}
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
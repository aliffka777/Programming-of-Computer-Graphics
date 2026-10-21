'use strict';

const $ = id => document.getElementById(id);

const state = {
  original: null,
  current: null,
  lastMethod: null,
  lastParams: null,
};

const origCanvas = $('origCanvas');
const outCanvas  = $('outCanvas');
const origCtx = origCanvas.getContext('2d');
const outCtx  = outCanvas.getContext('2d');
const origHistCanvas = $('origHist');
const outHistCanvas  = $('outHist');
const origHistCtx = origHistCanvas.getContext('2d');
const outHistCtx  = outHistCanvas.getContext('2d');

function setStatus(msg) { $('status').textContent = msg; }

function setProgress(p) {
  const wrap = $('progressWrap'), bar = $('progressBar'), txt = $('progressText');
  if (!wrap || !bar || !txt) return; // Защита, если элементов нет
  if (p <= 0) {
    wrap.classList.remove('hidden');
    bar.style.width = '0%'; txt.textContent = '0%';
  } else if (p >= 1) {
    bar.style.width = '100%'; txt.textContent = '100%';
    setTimeout(() => wrap.classList.add('hidden'), 300);
  } else {
    wrap.classList.remove('hidden');
    bar.style.width = (p * 100).toFixed(1) + '%';
    txt.textContent = (p * 100).toFixed(0) + '%';
  }
}

function drawHistogram(ctx, hist, color = '#7ea6ff') {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
  let mx = 0;
  for (let i = 0; i < 256; i++) if (hist[i] > mx) mx = hist[i];
  if (!mx) mx = 1;
  ctx.fillStyle = color;
  const barW = W / 256, pad = 6;
  for (let i = 0; i < 256; i++) {
    const h = (hist[i] / mx) * (H - pad);
    ctx.fillRect(i * barW, H - h, Math.max(1, barW), h);
  }
}

function updateHistograms() {
  if (state.original && origHistCtx) drawHistogram(origHistCtx, histogramGray(state.original.toGray()));
  if (state.current && outHistCtx)  drawHistogram(outHistCtx,  histogramGray(state.current.toGray()), '#8ef08e');
}

function updateStats() {
  if (state.original) {
    const s = stats(state.original.toGray());
    if ($('sOrigMean')) $('sOrigMean').textContent = s.mean.toFixed(1);
    if ($('sOrigStd'))  $('sOrigStd').textContent  = s.std.toFixed(1);
    if ($('sOrigEnt'))  $('sOrigEnt').textContent  = s.entropy.toFixed(3);
  }
  if (state.current) {
    const s = stats(state.current.toGray());
    if ($('sOutMean')) $('sOutMean').textContent = s.mean.toFixed(1);
    if ($('sOutStd'))  $('sOutStd').textContent  = s.std.toFixed(1);
    if ($('sOutEnt'))  $('sOutEnt').textContent  = s.entropy.toFixed(3);
  }
}

function fitAndSetCanvas(img) {
  const maxDim = 800;
  const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
  const W = Math.max(1, Math.round(img.width * sc));
  const H = Math.max(1, Math.round(img.height * sc));
  [origCanvas, outCanvas].forEach(c => { c.width = W; c.height = H; });
  origCtx.drawImage(img, 0, 0, W, H);
  outCtx.clearRect(0, 0, W, H);
  state.original = ImageBuffer.fromImageData(origCtx.getImageData(0, 0, W, H));
  state.current = state.original;
  updateHistograms(); updateStats();
  if ($('imgSize')) $('imgSize').textContent = `${img.width} × ${img.height} → ${W} × ${H}`;
  setStatus('Изображение загружено');
}

function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { fitAndSetCanvas(img); URL.revokeObjectURL(url); };
  img.onerror = () => setStatus('Ошибка загрузки изображения');
  img.src = url;
}

function loadFromCanvas(canvas) {
  if (!canvas) { console.error('loadFromCanvas: canvas is null'); return; }
  const W = canvas.width, H = canvas.height;
  if (W === 0 || H === 0) { setStatus('Ошибка: пустое тестовое изображение'); return; }
  
  [origCanvas, outCanvas].forEach(c => { c.width = W; c.height = H; });
  origCtx.drawImage(canvas, 0, 0);
  outCtx.clearRect(0, 0, W, H);
  
  state.original = ImageBuffer.fromImageData(origCtx.getImageData(0, 0, W, H));
  state.current = state.original;
  
  updateHistograms(); updateStats();
  if ($('imgSize')) $('imgSize').textContent = `${W} × ${H}`;
  setStatus('Тестовое изображение загружено');
}

function updateOutput(buf, methodInfo) {
  outCtx.putImageData(buf.toImageData(), 0, 0);
  state.current = buf;
  if (methodInfo) { state.lastMethod = methodInfo.name; state.lastParams = methodInfo.params; }
  updateHistograms(); updateStats();
}

function getEdgeMode() { return $('edgeMode') ? $('edgeMode').value : 'reflect'; }

async function runAlgorithm(fn, label, useWorker = false) {
  if (!state.original) { setStatus('Сначала загрузите изображение'); return; }
  setStatus('Обработка: ' + label);
  setProgress(0.05);
  await new Promise(r => setTimeout(r, 10));
  try {
    let result;
    if (useWorker && $('useThreads') && $('useThreads').checked) {
      result = await fn(state.original, p => setProgress(0.05 + 0.9 * p));
    } else {
      setProgress(0.5);
      await new Promise(r => setTimeout(r, 10));
      result = await fn(state.original);
    }
    updateOutput(result, { name: label, params: {} });
    setStatus('Готово: ' + label);
  } catch (e) {
    console.error(e);
    setStatus('Ошибка: ' + e.message);
  }
  setProgress(1);
}

function bindRange(inputId, labelId, format) {
  const i = $(inputId), l = $(labelId);
  if (!i || !l) return;
  const upd = () => l.textContent = format(i.value);
  i.addEventListener('input', upd);
  upd();
}

function initTabs() {
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const panel = $('tab-' + t.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });
}

function initUI() {
  initTabs();

  bindRange('brightnessRange', 'brightnessVal', v => v);
  bindRange('contrastRange',   'contrastVal',   v => (v / 100).toFixed(2));
  bindRange('gammaRange',      'gammaVal',      v => (v / 100).toFixed(2));
  bindRange('globalThreshold', 'globalThresholdVal', v => v);
  bindRange('windowSize',      'windowSizeVal', v => v);
  bindRange('sauvolaK',        'sauvolaKVal',   v => (v / 100).toFixed(2));
  bindRange('gaussSigma',      'gaussSigmaVal', v => (v / 10).toFixed(1));
  bindRange('unsharpAmount',   'unsharpAmountVal', v => (v / 100).toFixed(2));
  bindRange('medianRadius',    'medianRadiusVal', v => v);
  bindRange('structSize',      'structSizeVal', v => v);
  bindRange('claheTiles',      'claheTilesVal', v => v);
  bindRange('claheClip',       'claheClipVal',  v => v);

  if ($('file')) {
    $('file').addEventListener('change', e => {
      const f = e.target.files[0]; if (f) loadImageFile(f);
    });
  }

  if ($('applyPointOps')) $('applyPointOps').addEventListener('click', () => {
    const b = +$('brightnessRange').value;
    const c = +$('contrastRange').value / 100;
    const g = +$('gammaRange').value / 100;
    runAlgorithm(buf => applyPointOps(buf, b, c, g), `Поэлементные (b=${b}, c=${c}, γ=${g})`);
  });
  
  if ($('resetPointOps')) $('resetPointOps').addEventListener('click', () => {
    $('brightnessRange').value = 0;
    $('contrastRange').value = 100;
    $('gammaRange').value = 100;
    $('brightnessVal').textContent = '0';
    $('contrastVal').textContent = '1.00';
    $('gammaVal').textContent = '1.00';
  });

  if ($('applyLinearContrast')) $('applyLinearContrast').addEventListener('click', () =>
    runAlgorithm(buf => linearContrast(buf, 0.02, 0.98), 'Линейное контрастирование'));
  if ($('applyEqualizeRGB')) $('applyEqualizeRGB').addEventListener('click', () =>
    runAlgorithm(buf => equalizeRGB(buf), 'Эквализация RGB'));
  if ($('applyEqualizeHSV')) $('applyEqualizeHSV').addEventListener('click', () =>
    runAlgorithm(buf => equalizeHSV(buf), 'Эквализация HSV'));
  if ($('applyClahe')) $('applyClahe').addEventListener('click', () => {
    const t = +$('claheTiles').value, c = +$('claheClip').value;
    runAlgorithm(buf => clahe(buf, t, c), `CLAHE (${t}×${t}, clip=${c})`);
  });

  if ($('applyGlobalThreshold')) $('applyGlobalThreshold').addEventListener('click', () => {
    const t = +$('globalThreshold').value;
    runAlgorithm(buf => grayToBuffer(binarize(buf.toGray(), t), buf.width, buf.height),
      `Фикс. порог ${t}`);
  });
  
  if ($('applyOtsuThreshold')) $('applyOtsuThreshold').addEventListener('click', () =>
    runAlgorithm(buf => {
      const g = buf.toGray(); const t = otsuThreshold(g);
      return grayToBuffer(binarize(g, t), buf.width, buf.height);
    }, 'Порог Отсу'));

  if ($('applySauvola')) $('applySauvola').addEventListener('click', () => {
    const w = +$('windowSize').value, k = +$('sauvolaK').value / 100;
    runAlgorithm(buf => grayToBuffer(
      sauvolaThreshold(buf.toGray(), buf.width, buf.height, w, k),
      buf.width, buf.height), `Sauvola (win=${w}, k=${k})`);
  });
  
  if ($('applyWolf')) $('applyWolf').addEventListener('click', () => {
    const w = +$('windowSize').value, k = +$('sauvolaK').value / 100;
    runAlgorithm(buf => grayToBuffer(
      wolfThreshold(buf.toGray(), buf.width, buf.height, w, k),
      buf.width, buf.height), `Wolf (win=${w}, k=${k})`);
  });

  if ($('applyGauss')) $('applyGauss').addEventListener('click', () => {
    const sigma = +$('gaussSigma').value / 10, mode = getEdgeMode();
    runAlgorithm(async (buf, onProg) => {
      if ($('useThreads') && $('useThreads').checked)
        return await parallelConvolveBuffer(buf, gaussianKernel1D(sigma), mode, onProg);
      return separableConvolveBuffer(buf, gaussianKernel1D(sigma), mode);
    }, `Гаусс (σ=${sigma}, ${mode})`, true);
  });
  
  if ($('applyBox')) $('applyBox').addEventListener('click', () => {
    const r = Math.max(1, Math.round(+$('gaussSigma').value / 10)), mode = getEdgeMode();
    runAlgorithm(async (buf, onProg) => {
      if ($('useThreads') && $('useThreads').checked)
        return await parallelConvolveBuffer(buf, boxKernel1D(r), mode, onProg);
      return separableConvolveBuffer(buf, boxKernel1D(r), mode);
    }, `Box (r=${r}, ${mode})`, true);
  });

  if ($('applyUnsharp')) $('applyUnsharp').addEventListener('click', () => {
    const amount = +$('unsharpAmount').value / 100;
    const sigma  = +$('gaussSigma').value / 10;
    const mode   = getEdgeMode();
    runAlgorithm(buf => unsharpMask(buf, sigma, amount, mode),
      `Unsharp (σ=${sigma}, α=${amount})`);
  });
  
  if ($('applyLaplacian')) $('applyLaplacian').addEventListener('click', () => {
    const mode = getEdgeMode();
    runAlgorithm(buf => laplacianSharpen(buf, mode), 'Лапласиан');
  });

  if ($('applyMedian')) $('applyMedian').addEventListener('click', () => {
    const r = +$('medianRadius').value, mode = getEdgeMode();
    runAlgorithm(buf => medianFilterBuffer(buf, r, mode), `Медиана (r=${r})`);
  });

  if ($('applySobel')) $('applySobel').addEventListener('click', () => {
    const mode = getEdgeMode();
    runAlgorithm(buf => {
      const { mag } = sobel(buf.toGray(), buf.width, buf.height, mode);
      return grayToBuffer(visualizeMagnitude(mag), buf.width, buf.height);
    }, 'Sobel (модуль)');
  });
  
  if ($('applySobelDir')) $('applySobelDir').addEventListener('click', () => {
    const mode = getEdgeMode();
    runAlgorithm(buf => {
      const { mag, dir } = sobel(buf.toGray(), buf.width, buf.height, mode);
      return visualizeDirection(dir, mag, buf.width, buf.height);
    }, 'Sobel + направления');
  });
  
  if ($('applyCanny')) $('applyCanny').addEventListener('click', () => {
    const mode = getEdgeMode();
    runAlgorithm(buf => {
      const { binary } = canny(buf.toGray(), buf.width, buf.height,
        { sigma: 1.4, lowT: 0.08, highT: 0.20, mode });
      return grayToBuffer(binary, buf.width, buf.height);
    }, 'Canny (субпиксельный)');
  });

  const morphOp = op => {
    const type = $('structType').value, size = +$('structSize').value, mode = getEdgeMode();
    runAlgorithm(buf => {
      const se = makeStructElement(type, size);
      const res = morphComposite(buf.toGray(), buf.width, buf.height, se, op, mode);
      return grayToBuffer(res, buf.width, buf.height);
    }, `Морфология: ${op}`);
  };
  
  if ($('applyErode'))    $('applyErode').addEventListener('click',    () => morphOp('erode'));
  if ($('applyDilate'))   $('applyDilate').addEventListener('click',   () => morphOp('dilate'));
  if ($('applyOpen'))     $('applyOpen').addEventListener('click',     () => morphOp('open'));
  if ($('applyClose'))    $('applyClose').addEventListener('click',    () => morphOp('close'));
  if ($('applyMorphGrad'))$('applyMorphGrad').addEventListener('click',() => morphOp('gradient'));
  if ($('applyTopHat'))   $('applyTopHat').addEventListener('click',   () => morphOp('tophat'));
  if ($('applyBlackHat')) $('applyBlackHat').addEventListener('click', () => morphOp('blackhat'));

  if ($('resetAll')) $('resetAll').addEventListener('click', () => {
    if (!state.original) return;
    state.current = state.original;
    outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
    updateHistograms(); updateStats();
    setStatus('Результат сброшен');
  });
  
  if ($('download')) $('download').addEventListener('click', () => {
    if (!state.current) return;
    const link = document.createElement('a');
    link.download = 'processed.png';
    link.href = outCanvas.toDataURL('image/png');
    link.click();
    setStatus('Изображение скачано');
  });

  if ($('buildReport')) $('buildReport').addEventListener('click', async () => {
    if (!state.original) { setStatus('Сначала загрузите изображение'); return; }
    setStatus('Формирование отчёта...');
    setProgress(0.05);
    try {
      const html = await buildReportHTML(
        state.original,
        origCanvas.toDataURL('image/png'),
        p => setProgress(0.05 + 0.9 * p)
      );
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'report.html'; a.click();
      URL.revokeObjectURL(url);
      setStatus('Отчёт сформирован и скачан');
    } catch (e) {
      console.error(e);
      setStatus('Ошибка отчёта: ' + e.message);
    }
    setProgress(1);
  });

  try {
    if (typeof makeTestImages === 'function') {
      const tests = makeTestImages();
      document.querySelectorAll('.test-card').forEach(card => {
        const key = card.dataset.test;
        const cv = card.querySelector('canvas');
        const btn = card.querySelector('.load-test');

        if (!cv || !btn || !tests[key]) return;

        cv.getContext('2d').drawImage(tests[key], 0, 0);

        btn.addEventListener('click', () => {
          loadFromCanvas(tests[key]);
          const processTab = document.querySelector('.tab[data-tab="process"]');
          if (processTab) processTab.click();
        });
      });
    }
  } catch (e) {
    console.error('Ошибка при подготовке тестовых изображений:', e);
  }

  if ($('threadsInfo')) {
    $('threadsInfo').textContent = `Потоков: ${getThreadCount ? getThreadCount() : '—'}`;
  }

  if ($('globalThreshold')) {
    $('globalThreshold').addEventListener('input', () => {
      if (!state.original) return;
      const t = +$('globalThreshold').value;
      const res = grayToBuffer(binarize(state.original.toGray(), t), state.original.width, state.original.height);
      updateOutput(res);
    });
  }

  let lastAdaptive = null;
  if ($('applySauvola')) $('applySauvola').addEventListener('click', () => { lastAdaptive = 'sauvola'; });
  if ($('applyWolf'))    $('applyWolf').addEventListener('click',    () => { lastAdaptive = 'wolf'; });

  function updateAdaptiveLive() {
    if (!state.original || !lastAdaptive) return;
    const w = +$('windowSize').value, k = +$('sauvolaK').value / 100;
    const g = state.original.toGray();
    const res = lastAdaptive === 'sauvola'
      ? sauvolaThreshold(g, state.original.width, state.original.height, w, k)
      : wolfThreshold(g, state.original.width, state.original.height, w, k);
    updateOutput(grayToBuffer(res, state.original.width, state.original.height));
  }
  if ($('windowSize')) $('windowSize').addEventListener('input', updateAdaptiveLive);
  if ($('sauvolaK'))   $('sauvolaK').addEventListener('input',   updateAdaptiveLive);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}
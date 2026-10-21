'use strict';

function histogramGray(g) {
  const h = new Uint32Array(256);
  for (let i = 0; i < g.length; i++) h[g[i] | 0]++;
  return h;
}

function entropy(gray) {
  const h = histogramGray(gray), N = gray.length;
  let e = 0;
  for (let i = 0; i < 256; i++) if (h[i]) { const p = h[i] / N; e -= p * Math.log2(p); }
  return e;
}

function stats(gray) {
  let s = 0;
  for (let i = 0; i < gray.length; i++) s += gray[i];
  const m = s / gray.length;
  let v = 0;
  for (let i = 0; i < gray.length; i++) { const d = gray[i] - m; v += d * d; }
  return { mean: m, std: Math.sqrt(v / gray.length), entropy: entropy(gray) };
}

function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max, d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s, v];
}

function hsv2rgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
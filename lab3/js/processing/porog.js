'use strict';

function binarize(g, thr) {
  const out = new Float32Array(g.length);
  for (let i = 0; i < g.length; i++) out[i] = g[i] > thr ? 255 : 0;
  return out;
}

function otsuThreshold(gray) {
  const hist = histogramGray(gray), total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, varMax = 0, thr = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > varMax) { varMax = v; thr = t; }
  }
  return thr;
}

function integralImage(src, W, H) {
  const W1 = W + 1;
  const sat = new Float64Array(W1 * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += src[y * W + x];
      sat[(y + 1) * W1 + (x + 1)] = sat[y * W1 + (x + 1)] + row;
    }
  }
  return sat;
}

function rectSum(sat, W, x0, y0, x1, y1) {
  const W1 = W + 1;
  return sat[y1 * W1 + x1] - sat[y0 * W1 + x1] - sat[y1 * W1 + x0] + sat[y0 * W1 + x0];
}

function sauvolaThreshold(gray, W, H, windowSize, k = 0.2, R = 128) {
  const sat = integralImage(gray, W, H);
  const sq = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) sq[i] = gray[i] * gray[i];
  const satSq = integralImage(sq, W, H);
  const r = windowSize >> 1;
  const out = new Float32Array(gray.length);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
      const n = (x1 - x0) * (y1 - y0);
      const s = rectSum(sat, W, x0, y0, x1, y1);
      const s2 = rectSum(satSq, W, x0, y0, x1, y1);
      const mean = s / n;
      const std = Math.sqrt(Math.max(0, s2 / n - mean * mean));
      const T = mean * (1 + k * (std / R - 1));
      out[y * W + x] = gray[y * W + x] > T ? 255 : 0;
    }
  }
  return out;
}

function wolfThreshold(gray, W, H, windowSize, k = 0.5) {
  const sat = integralImage(gray, W, H);
  const sq = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) sq[i] = gray[i] * gray[i];
  const satSq = integralImage(sq, W, H);
  let gmin = Infinity, gmax = -Infinity;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < gmin) gmin = gray[i];
    if (gray[i] > gmax) gmax = gray[i];
  }
  const R = (gmax - gmin) || 1;
  const r = windowSize >> 1;
  const out = new Float32Array(gray.length);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
      const n = (x1 - x0) * (y1 - y0);
      const s = rectSum(sat, W, x0, y0, x1, y1);
      const s2 = rectSum(satSq, W, x0, y0, x1, y1);
      const mean = s / n;
      const std = Math.sqrt(Math.max(0, s2 / n - mean * mean));
      const T = mean - k * (1 - std / R) * (mean - gmin);
      out[y * W + x] = gray[y * W + x] > T ? 255 : 0;
    }
  }
  return out;
}
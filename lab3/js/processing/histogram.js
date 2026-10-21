'use strict';

function histogramRGB(buf) {
  const hR = new Uint32Array(256), hG = new Uint32Array(256), hB = new Uint32Array(256);
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) { hR[d[i]]++; hG[d[i + 1]]++; hB[d[i + 2]]++; }
  return { hR, hG, hB };
}

function buildEqualizationLUT(hist, total) {
  const lut = new Uint8ClampedArray(256);
  let cdfMin = 0;
  for (let i = 0; i < 256; i++) if (hist[i]) { cdfMin = hist[i]; break; }
  const denom = (total - cdfMin) || 1;
  let cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += hist[i];
    lut[i] = Math.round(((cum - cdfMin) / denom) * 255);
  }
  return lut;
}

function equalizeRGB(buf) {
  const out = buf.clone();
  const { hR, hG, hB } = histogramRGB(buf);
  const N = buf.length;
  const lR = buildEqualizationLUT(hR, N);
  const lG = buildEqualizationLUT(hG, N);
  const lB = buildEqualizationLUT(hB, N);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lR[d[i]]; d[i + 1] = lG[d[i + 1]]; d[i + 2] = lB[d[i + 2]];
  }
  return out;
}

function equalizeHSV(buf) {
  const N = buf.length, d = buf.data;
  const V = new Uint8ClampedArray(N), H = new Float32Array(N), S = new Float32Array(N);
  for (let i = 0, j = 0; j < N; i += 4, j++) {
    const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
    H[j] = h; S[j] = s; V[j] = Math.round(v * 255);
  }
  const hist = new Uint32Array(256);
  for (let i = 0; i < N; i++) hist[V[i]]++;
  const lut = buildEqualizationLUT(hist, N);
  const out = buf.clone(); const od = out.data;
  for (let i = 0, j = 0; j < N; i += 4, j++) {
    const nv = lut[V[j]] / 255;
    const [r, g, b] = hsv2rgb(H[j], S[j], nv);
    od[i] = r; od[i + 1] = g; od[i + 2] = b;
  }
  return out;
}

/* CLAHE */
function extractV(buf) {
  const v = new Float32Array(buf.length), d = buf.data;
  for (let i = 0, j = 0; j < v.length; i += 4, j++)
    v[j] = Math.max(d[i], d[i + 1], d[i + 2]);
  return v;
}

function claheCore(channel, W, H, tilesGrid, clipLimit) {
  const tileW = Math.ceil(W / tilesGrid), tileH = Math.ceil(H / tilesGrid);
  const nx = Math.ceil(W / tileW), ny = Math.ceil(H / tileH);
  const luts = new Array(ny);
  for (let ty = 0; ty < ny; ty++) {
    luts[ty] = new Array(nx);
    const y0 = ty * tileH, y1 = Math.min(H, y0 + tileH);
    for (let tx = 0; tx < nx; tx++) {
      const x0 = tx * tileW, x1 = Math.min(W, x0 + tileW);
      const hist = new Uint32Array(256);
      let n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) { hist[channel[y * W + x] | 0]++; n++; }
      const limit = Math.max(1, Math.floor(clipLimit * n / 256));
      let excess = 0;
      for (let i = 0; i < 256; i++) if (hist[i] > limit) { excess += hist[i] - limit; hist[i] = limit; }
      const inc = Math.floor(excess / 256), rem = excess - inc * 256;
      for (let i = 0; i < 256; i++) hist[i] += inc + (i < rem ? 1 : 0);
      const lut = new Uint8ClampedArray(256);
      let cum = 0;
      for (let i = 0; i < 256; i++) { cum += hist[i]; lut[i] = Math.round((cum / n) * 255); }
      luts[ty][tx] = lut;
    }
  }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const tyf = y / tileH - 0.5, ty0 = Math.floor(tyf), fy = tyf - ty0;
    const cy0 = Math.max(0, Math.min(ny - 1, ty0));
    const cy1 = Math.max(0, Math.min(ny - 1, ty0 + 1));
    for (let x = 0; x < W; x++) {
      const txf = x / tileW - 0.5, tx0 = Math.floor(txf), fx = txf - tx0;
      const cx0 = Math.max(0, Math.min(nx - 1, tx0));
      const cx1 = Math.max(0, Math.min(nx - 1, tx0 + 1));
      const v = channel[y * W + x] | 0;
      const q00 = luts[cy0][cx0][v], q10 = luts[cy0][cx1][v];
      const q01 = luts[cy1][cx0][v], q11 = luts[cy1][cx1][v];
      out[y * W + x] = q00 * (1 - fx) * (1 - fy) + q10 * fx * (1 - fy)
                     + q01 * (1 - fx) * fy + q11 * fx * fy;
    }
  }
  return out;
}

function clahe(buf, tilesGrid, clipLimit) {
  const W = buf.width, H = buf.height;
  const V = extractV(buf);
  const newV = claheCore(V, W, H, tilesGrid, clipLimit);
  const out = buf.clone(); const d = buf.data, od = out.data;
  for (let i = 0, j = 0; j < V.length; i += 4, j++) {
    const oldV = V[j] || 1;
    const sc = newV[j] / oldV;
    od[i] = Math.min(255, d[i] * sc);
    od[i + 1] = Math.min(255, d[i + 1] * sc);
    od[i + 2] = Math.min(255, d[i + 2] * sc);
  }
  return out;
}

function linearContrast(buf, lowPct = 0.02, highPct = 0.98) {
  const gray = buf.toGray();
  const hist = histogramGray(gray);
  const N = gray.length;
  let c = 0, minIn = 0, maxIn = 255;
  const lowCount = N * lowPct, highCount = N * (1 - highPct);
  for (let i = 0; i < 256; i++) { c += hist[i]; if (c > lowCount) { minIn = i; break; } }
  c = 0;
  for (let i = 255; i >= 0; i--) { c += hist[i]; if (c > highCount) { maxIn = i; break; } }
  if (maxIn - minIn < 5) return buf.clone();
  const range = maxIn - minIn;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const v = ((i - minIn) / range) * 255;
    lut[i] = Math.max(0, Math.min(255, v));
  }
  const out = buf.clone(); const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
  }
  return out;
}
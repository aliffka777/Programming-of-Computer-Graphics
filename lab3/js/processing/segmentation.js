'use strict';

function sobel(gray, W, H, mode) {
  const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
  const mag = new Float32Array(W * H), dir = new Float32Array(W * H);
  const Kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const Ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let sx = 0, sy = 0, k = 0;
    for (let j = -1; j <= 1; j++) {
      const yy = edgeIndex(y + j, H, mode);
      for (let i = -1; i <= 1; i++, k++) {
        const xx = edgeIndex(x + i, W, mode);
        const v = gray[yy * W + xx];
        sx += Kx[k] * v; sy += Ky[k] * v;
      }
    }
    gx[y * W + x] = sx; gy[y * W + x] = sy;
    mag[y * W + x] = Math.hypot(sx, sy);
    dir[y * W + x] = Math.atan2(sy, sx);
  }
  return { gx, gy, mag, dir };
}

function visualizeMagnitude(mag) {
  let mx = 0; for (let i = 0; i < mag.length; i++) if (mag[i] > mx) mx = mag[i];
  const out = new Float32Array(mag.length), sc = 255 / (mx || 1);
  for (let i = 0; i < mag.length; i++) out[i] = mag[i] * sc;
  return out;
}

function visualizeDirection(dir, mag, W, H) {
  const buf = ImageBuffer.blank(W, H);
  let mx = 0; for (let i = 0; i < mag.length; i++) if (mag[i] > mx) mx = mag[i];
  const d = buf.data;
  for (let i = 0; i < W * H; i++) {
    const hue = ((dir[i] + Math.PI) / (2 * Math.PI)) * 360;
    const val = mx > 0 ? Math.min(1, mag[i] / mx) : 0;
    const [r, g, b] = hsv2rgb(hue, 1, val);
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b;
  }
  return buf;
}

function sampleMag(mag, W, H, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
  const cx0 = Math.max(0, Math.min(W - 1, x0));
  const cy0 = Math.max(0, Math.min(H - 1, y0));
  const a = mag[cy0 * W + cx0], b = mag[cy0 * W + x1];
  const c = mag[y1 * W + cx0], d = mag[y1 * W + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

function canny(gray, W, H, opts = {}) {
  const sigma = opts.sigma ?? 1.4;
  const lowT = opts.lowT ?? 0.10;
  const highT = opts.highT ?? 0.25;
  const mode = opts.mode || EdgeMode.REFLECT;

  const k1d = gaussianKernel1D(sigma);
  const rr = k1d.length >> 1;
  const sm = new Float32Array(W * H);
  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let i = -rr; i <= rr; i++)
      s += k1d[i + rr] * gray[edgeIndex(y, H, mode) * W + edgeIndex(x + i, W, mode)];
    tmp[y * W + x] = s;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let j = -rr; j <= rr; j++)
      s += k1d[j + rr] * tmp[edgeIndex(y + j, H, mode) * W + x];
    sm[y * W + x] = s;
  }

  const { mag, dir } = sobel(sm, W, H, mode);

  const nms = new Float32Array(W * H);
  const subpix = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x;
      const a = dir[idx];
      const c = Math.cos(a), s = Math.sin(a);
      const mPrev = sampleMag(mag, W, H, x - c, y - s);
      const mNext = sampleMag(mag, W, H, x + c, y + s);
      const m = mag[idx];
      if (m >= mPrev && m >= mNext) {
        nms[idx] = m;
        const denom = mPrev - 2 * m + mNext;
        if (Math.abs(denom) > 1e-6) {
          const delta = 0.5 * (mPrev - mNext) / denom;
          subpix[idx] = Math.max(-0.5, Math.min(0.5, delta));
        }
      }
    }
  }

  let mmax = 0;
  for (let i = 0; i < nms.length; i++) if (nms[i] > mmax) mmax = nms[i];
  const lo = mmax * lowT, hi = mmax * highT;
  const state = new Uint8Array(W * H);
  for (let i = 0; i < nms.length; i++) {
    if (nms[i] >= hi) state[i] = 2;
    else if (nms[i] >= lo) state[i] = 1;
  }
  const stack = [];
  for (let i = 0; i < state.length; i++) if (state[i] === 2) stack.push(i);
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i / W) | 0;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      if (!j && !k) continue;
      const nx = x + k, ny = y + j;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (state[ni] === 1) { state[ni] = 2; stack.push(ni); }
    }
  }
  const binary = new Float32Array(W * H);
  for (let i = 0; i < state.length; i++) binary[i] = state[i] === 2 ? 255 : 0;
  return { binary, subpixel: subpix, nms, mag, dir };
}
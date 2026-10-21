'use strict';

function gaussianKernel1D(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const k = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    k[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += k[i];
  }
  for (let i = 0; i < size; i++) k[i] /= sum;
  return k;
}

function boxKernel1D(radius) {
  const size = radius * 2 + 1, k = new Float32Array(size);
  for (let i = 0; i < size; i++) k[i] = 1 / size;
  return k;
}

function separableConvolveBuffer(buf, k, mode) {
  const W = buf.width, H = buf.height, r = k.length >> 1;
  const out = buf.clone(), tmp = new Float32Array(W * H), d = buf.data;
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < H; y++) {
      const base = y * W;
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let i = -r; i <= r; i++) {
          const xx = edgeIndex(x + i, W, mode);
          s += k[i + r] * d[(base + xx) * 4 + c];
        }
        tmp[base + x] = s;
      }
    }
    
    const od = out.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let j = -r; j <= r; j++) {
          const yy = edgeIndex(y + j, H, mode);
          s += k[j + r] * tmp[yy * W + x];
        }
        od[(y * W + x) * 4 + c] = s;
      }
    }
  }
  return out;
}

function unsharpMask(buf, sigma, amount, mode) {
  const blur = separableConvolveBuffer(buf, gaussianKernel1D(sigma), mode);
  const out = buf.clone();
  const d = buf.data, bd = blur.data, od = out.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = d[i + c] + amount * (d[i + c] - bd[i + c]);
      od[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return out;
}

function laplacianSharpen(buf, mode) {
  const W = buf.width, H = buf.height;
  const out = buf.clone(), d = buf.data, od = out.data;
  const lap = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    for (let c = 0; c < 3; c++) {
      let s = 0, k = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++, k++) {
        const xx = edgeIndex(x + i, W, mode), yy = edgeIndex(y + j, H, mode);
        s += lap[k] * d[(yy * W + xx) * 4 + c];
      }
      const v = d[(y * W + x) * 4 + c] - s;
      od[(y * W + x) * 4 + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return out;
}
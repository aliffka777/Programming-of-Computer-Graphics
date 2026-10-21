'use strict';

function applyPointOps(buf, brightness, contrast, gamma) {
  const out = buf.clone();
  const lut = new Uint8ClampedArray(256);
  const invGamma = 1 / Math.max(0.01, gamma);
  for (let i = 0; i < 256; i++) {
    let v = (i - 128) * contrast + 128 + brightness;
    v = Math.max(0, Math.min(255, v));
    v = Math.pow(v / 255, invGamma) * 255;
    lut[i] = v;
  }
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
  }
  return out;
}
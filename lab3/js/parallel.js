'use strict';

const workerSource = `
self.onmessage = function(e) {
  const { id, payload } = e.data;
  const { data, W, H, y0, y1, kernel, mode } = payload;
  const r = kernel.length >> 1;
  const stripH = y1 - y0;
  const out = new Float32Array(stripH * W * 4);

  function edgeIdx(i, size, mode) {
    if (i >= 0 && i < size) return i;
    if (mode === 'clamp') return i < 0 ? 0 : size - 1;
    if (i < 0) i = -i;
    if (i >= size) i = 2 * size - 2 - i;
    if (i < 0) i = 0;
    if (i >= size) i = size - 1;
    return i;
  }

  
  const hy0 = Math.max(0, y0 - r);
  const hy1 = Math.min(H, y1 + r);
  const tmpH = hy1 - hy0;
  const tmp = new Float32Array(tmpH * W * 3);
  for (let y = hy0; y < hy1; y++) {
    const ly = y - hy0;
    for (let x = 0; x < W; x++) {
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let i = -r; i <= r; i++) {
          const xx = edgeIdx(x + i, W, mode);
          s += kernel[i + r] * data[(y * W + xx) * 4 + c];
        }
        tmp[(ly * W + x) * 3 + c] = s;
      }
    }
  }

  
  for (let y = y0; y < y1; y++) {
    const ly = y - y0;
    for (let x = 0; x < W; x++) {
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let j = -r; j <= r; j++) {
          const yy = edgeIdx(y + j, H, mode);
          const ty = yy - hy0;
          s += kernel[j + r] * tmp[(ty * W + x) * 3 + c];
        }
        out[(ly * W + x) * 4 + c] = s;
      }
    }
  }
  self.postMessage({ id, out, y0, y1 }, [out.buffer]);
};
`;

const workerURL = URL.createObjectURL(
  new Blob([workerSource], { type: 'application/javascript' })
);

function getThreadCount() {
  const n = navigator.hardwareConcurrency || 4;
  return Math.max(1, Math.min(8, n));
}

async function parallelConvolveBuffer(buf, kernel, mode, onProgress) {
  const W = buf.width, H = buf.height;
  const nThreads = Math.min(getThreadCount(), Math.max(1, H >> 6));
  const strip = Math.ceil(H / nThreads);
  const promises = [];
  for (let t = 0; t < nThreads; t++) {
    const y0 = t * strip, y1 = Math.min(H, y0 + strip);
    if (y0 >= y1) continue;
    promises.push(new Promise(resolve => {
      const w = new Worker(workerURL);
      w.onmessage = (e) => { resolve(e.data); w.terminate(); };
      w.postMessage({ id: t, payload: { data: buf.data, W, H, y0, y1, kernel, mode } });
    }));
  }
  const results = await Promise.all(promises);
  const out = buf.clone();
  for (const r of results) {
    const rows = r.y1 - r.y0;
    for (let i = 0; i < rows * W; i++) {
      const srcIdx = i * 4;
      const dstIdx = (r.y0 * W + i) * 4;
      
      out.data[dstIdx]     = r.out[srcIdx];
      out.data[dstIdx + 1] = r.out[srcIdx + 1];
      out.data[dstIdx + 2] = r.out[srcIdx + 2];
    }
  }
  if (onProgress) onProgress(1);
  return out;
}
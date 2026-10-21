'use strict';

function makeStructElement(type, size) {
  let s = size % 2 === 0 ? size + 1 : size;
  s = Math.max(3, s);
  const r = s >> 1, se = [];
  for (let y = -r; y <= r; y++) {
    const row = [];
    for (let x = -r; x <= r; x++) {
      let on = 1;
      if (type === 'cross') on = (x === 0 || y === 0) ? 1 : 0;
      else if (type === 'ellipse') {
        const rr = Math.max(r, 0.5);
        on = (x * x + y * y) <= rr * rr + 1e-6 ? 1 : 0;
      }
      row.push(on);
    }
    se.push(row);
  }
  return se;
}

function morphology(gray, W, H, se, isDilate, mode) {
  const r = se.length >> 1;
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = isDilate ? -Infinity : Infinity;
    for (let j = -r; j <= r; j++) {
      const yy = edgeIndex(y + j, H, mode);
      for (let i = -r; i <= r; i++) {
        if (!se[j + r][i + r]) continue;
        const xx = edgeIndex(x + i, W, mode);
        const s = gray[yy * W + xx];
        if (isDilate) { if (s > v) v = s; } else { if (s < v) v = s; }
      }
    }
    out[y * W + x] = v;
  }
  return out;
}

function morphComposite(gray, W, H, se, op, mode) {
  const dil = () => morphology(gray, W, H, se, true, mode);
  const ero = () => morphology(gray, W, H, se, false, mode);
  switch (op) {
    case 'dilate': return dil();
    case 'erode': return ero();
    case 'open': return morphology(ero(), W, H, se, true, mode);
    case 'close': return morphology(dil(), W, H, se, false, mode);
    case 'gradient': {
      const d = dil(), e = ero(), out = new Float32Array(W * H);
      for (let i = 0; i < out.length; i++) out[i] = Math.max(0, d[i] - e[i]);
      return out;
    }
    case 'tophat': {
      const opened = morphology(ero(), W, H, se, true, mode);
      const out = new Float32Array(W * H);
      for (let i = 0; i < out.length; i++) out[i] = Math.max(0, gray[i] - opened[i]);
      return out;
    }
    case 'blackhat': {
      const closed = morphology(dil(), W, H, se, false, mode);
      const out = new Float32Array(W * H);
      for (let i = 0; i < out.length; i++) out[i] = Math.max(0, closed[i] - gray[i]);
      return out;
    }
    default: return gray.slice();
  }
}
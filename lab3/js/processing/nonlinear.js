'use strict';

function medianFilterGray(gray, W, H, radius, mode) {
  const out = new Float32Array(W * H);
  const win = new Float32Array((2 * radius + 1) ** 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let k = 0;
    for (let j = -radius; j <= radius; j++) {
      const yy = edgeIndex(y + j, H, mode);
      for (let i = -radius; i <= radius; i++, k++) {
        const xx = edgeIndex(x + i, W, mode);
        win[k] = gray[yy * W + xx];
      }
    }
    const arr = Array.from(win).sort((a, b) => a - b);
    out[y * W + x] = arr[arr.length >> 1];
  }
  return out;
}

function medianFilterBuffer(buf, radius, mode) {
  const out = buf.clone();
  for (let c = 0; c < 3; c++) {
    const ch = buf.channelFloat(c);
    out.setChannelFloat(c, medianFilterGray(ch, buf.width, buf.height, radius, mode));
  }
  return out;
}
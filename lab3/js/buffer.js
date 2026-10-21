'use strict';

const EdgeMode = { CLAMP: 'clamp', REFLECT: 'reflect' };

function edgeIndex(i, size, mode) {
  if (i >= 0 && i < size) return i;
  if (mode === EdgeMode.CLAMP) return i < 0 ? 0 : size - 1;
  if (i < 0) i = -i;
  if (i >= size) i = 2 * size - 2 - i;
  if (i < 0) i = 0;
  if (i >= size) i = size - 1;
  return i;
}

class ImageBuffer {
  constructor(width, height, data) {
    this.width = width;
    this.height = height;
    this.data = data || new Uint8ClampedArray(width * height * 4);
  }
  static fromImageData(id) {
    return new ImageBuffer(id.width, id.height, new Uint8ClampedArray(id.data));
  }
  static blank(width, height) {
    const b = new ImageBuffer(width, height);
    for (let i = 3; i < b.data.length; i += 4) b.data[i] = 255;
    return b;
  }
  clone() {
    return new ImageBuffer(this.width, this.height, new Uint8ClampedArray(this.data));
  }
  get length() { return this.width * this.height; }
  toImageData() {
    return new ImageData(new Uint8ClampedArray(this.data), this.width, this.height);
  }
  channelFloat(c) {
    const out = new Float32Array(this.length);
    const d = this.data;
    for (let i = c, j = 0; j < out.length; i += 4, j++) out[j] = d[i];
    return out;
  }
  setChannelFloat(c, arr) {
    const d = this.data;
    for (let i = c, j = 0; j < arr.length; i += 4, j++) {
      const v = arr[j]; d[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  toGray() {
    const g = new Float32Array(this.length);
    const d = this.data;
    for (let i = 0, j = 0; j < g.length; i += 4, j++)
      g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return g;
  }
  setGray(g) {
    const d = this.data;
    for (let i = 0, j = 0; j < g.length; i += 4, j++) {
      const v = g[j] < 0 ? 0 : g[j] > 255 ? 255 : g[j];
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  }
}

function grayToBuffer(gray, W, H) {
  const b = ImageBuffer.blank(W, H);
  b.setGray(gray);
  return b;
}
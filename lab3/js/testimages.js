'use strict';

function makeTestImages() {
  return {
    noisy: genNoisy(),
    blurry: genBlurry(),
    lowContrast: genLowContrast(),
    textUneven: genTextUneven(),
    smallDetails: genSmallDetails(),
    edges: genEdges(),
  };
}

function genNoisy() {
  const W = 220, H = 220, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#4466aa'); grd.addColorStop(1, '#aa6644');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#eee'; ctx.beginPath();
  ctx.arc(60, 60, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(120, 120, 70, 70);
  ctx.fillStyle = '#222'; ctx.font = 'bold 32px Arial';
  ctx.fillText('ЛР3', 40, 190);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() + Math.random() + Math.random() - 1.5) * 40;
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, d[i + k] + n));
    if (Math.random() < 0.02) {
      const v = Math.random() < 0.5 ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

function genBlurry() {
  const W = 220, H = 220, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#eee'; ctx.beginPath();
  ctx.arc(80, 80, 35, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(120, 120, 70, 70);
  ctx.strokeStyle = '#f33'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(20, 200); ctx.lineTo(200, 170); ctx.stroke();
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  const tctx = tmp.getContext('2d');
  tctx.filter = 'blur(4px)';
  tctx.drawImage(c, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(tmp, 0, 0);
  return c;
}

function genLowContrast() {
  const W = 220, H = 220, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a7a7a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#909090'; ctx.beginPath();
  ctx.arc(70, 70, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(120, 120, 70, 70);
  ctx.fillStyle = '#666'; ctx.font = 'bold 36px Arial';
  ctx.fillText('ТЕКСТ', 30, 200);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const v = d[i + k];
      d[i + k] = 90 + (v / 255) * 75;
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

function genTextUneven() {
  const W = 220, H = 220, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(110, 110, 20, 110, 110, 160);
  grd.addColorStop(0, '#f0f0f0'); grd.addColorStop(1, '#606060');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('СТРОКА 1', 15, 50);
  ctx.fillText('СТРОКА 2', 15, 90);
  ctx.font = '18px Arial';
  ctx.fillText('обычный текст', 15, 130);
  ctx.fillText('ещё строка', 15, 165);
  ctx.fillText('и последняя', 15, 195);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, d[i + k] + n));
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

function genSmallDetails() {
  const W = 220, H = 220, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#303030'); grd.addColorStop(1, '#a0a0a0');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = '#000';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    ctx.fillRect(x, y, 2, 2);
  }
  return c;
}

function genEdges() {
  const W = 220, H = 220, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#202020'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(30, 30, 60, 60);
  ctx.beginPath(); ctx.arc(160, 60, 35, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(110, 160);
  ctx.rotate(Math.PI / 6);
  ctx.fillRect(-40, -20, 80, 40);
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(220, 180); ctx.stroke();
  return c;
}
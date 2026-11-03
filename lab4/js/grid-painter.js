/* Компонент UI для масштабирования, панорамирования и отрисовки сетки и пикселей */
class GridPainter {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellBase = 20;
        this.scale = 1;
        this.offsetX = canvas.width / 2;
        this.offsetY = canvas.height / 2;
        this.dragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this._bindEvents();
    }

    get cellSize() { return this.cellBase * this.scale; }

    worldToScreen(wx, wy) {
        const cs = this.cellSize;
        return { x: this.offsetX + wx * cs, y: this.offsetY - wy * cs };
    }
    screenToWorld(sx, sy) {
        const cs = this.cellSize;
        return { x: (sx - this.offsetX) / cs, y: (this.offsetY - sy) / cs };
    }

    _bindEvents() {
        const c = this.canvas;
        c.addEventListener('mousedown', e => this._startDrag(e.clientX, e.clientY));
        window.addEventListener('mousemove', e => this._onDrag(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => this._stopDrag());
        c.addEventListener('touchstart', e => {
            if (e.touches.length) this._startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        c.addEventListener('touchmove', e => {
            if (e.touches.length) this._onDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        c.addEventListener('touchend', () => this._stopDrag());
    }
    _startDrag(x, y) { this.dragging = true; this.lastX = x; this.lastY = y; }
    _onDrag(x, y) {
        if (!this.dragging) return;
        const dx = x - this.lastX, dy = y - this.lastY;
        this.offsetX += dx; this.offsetY += dy;
        this.lastX = x; this.lastY = y;
        this.redraw(this._grid);
    }
    _stopDrag() { this.dragging = false; }

    zoom(factor) {
        this.scale = Math.max(0.1, Math.min(10, this.scale * factor));
        this.redraw(this._grid);
        return this.scale;
    }
    reset() {
        this.scale = 1;
        this.offsetX = this.canvas.width / 2;
        this.offsetY = this.canvas.height / 2;
        this.redraw(this._grid);
        return this.scale;
    }

    redraw(grid) {
        this._grid = grid;
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        ctx.clearRect(0, 0, W, H);
        this._drawGrid();
        this._drawAxes();
        if (grid) this._drawPixels(grid);
    }

    _drawGrid() {
        const ctx = this.ctx;
        const cs = this.cellSize;
        const W = this.canvas.width, H = this.canvas.height;

        const w0 = this.screenToWorld(0, 0);
        const w1 = this.screenToWorld(W, H);
        const minWX = Math.floor(Math.min(w0.x, w1.x)) - 1;
        const maxWX = Math.ceil(Math.max(w0.x, w1.x))  + 1;
        const minWY = Math.floor(Math.min(w0.y, w1.y)) - 1;
        const maxWY = Math.ceil(Math.max(w0.y, w1.y))  + 1;

        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 0.5;

        for (let i = minWX; i <= maxWX; i++) {
            const s = this.worldToScreen(i - 0.5, 0);
            ctx.beginPath(); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, H); ctx.stroke();
        }
        for (let j = minWY; j <= maxWY; j++) {
            const s = this.worldToScreen(0, j + 0.5);
            ctx.beginPath(); ctx.moveTo(0, s.y); ctx.lineTo(W, s.y); ctx.stroke();
        }
    }

    _drawAxes() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        const origin = this.worldToScreen(0, 0);

        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.6;

        ctx.beginPath();
        ctx.moveTo(0, origin.y);
        ctx.lineTo(W, origin.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, H);
        ctx.stroke();

        ctx.fillStyle = '#2c3e50';
        ctx.font = '11px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = -20; i <= 20; i++) {
            if (i === 0) continue;
            const s = this.worldToScreen(i, 0);
            if (s.x > 10 && s.x < W - 10) {
                ctx.fillText(i, s.x, origin.y + 3);
                ctx.beginPath();
                ctx.moveTo(s.x, origin.y - 3);
                ctx.lineTo(s.x, origin.y + 3);
                ctx.stroke();
            }
        }
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let j = -20; j <= 20; j++) {
            if (j === 0) continue;
            const s = this.worldToScreen(0, j);
            if (s.y > 10 && s.y < H - 10) {
                ctx.fillText(j, origin.x - 4, s.y);
                ctx.beginPath();
                ctx.moveTo(origin.x - 3, s.y);
                ctx.lineTo(origin.x + 3, s.y);
                ctx.stroke();
            }
        }

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 13px Segoe UI';
        ctx.fillStyle = '#2c3e50';
        ctx.fillText('O', origin.x - 9, origin.y + 9);
        ctx.fillText('X', W - 12, origin.y - 12);
        ctx.fillText('Y', origin.x + 12, 12);
    }

    _drawPixels(grid) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const W = this.canvas.width, H = this.canvas.height;

    const w0 = this.screenToWorld(0, 0);
    const w1 = this.screenToWorld(W, H);
    const minX = Math.floor(Math.min(w0.x, w1.x)) - 1;
    const maxX = Math.ceil(Math.max(w0.x, w1.x)) + 1;
    const minY = Math.floor(Math.min(w0.y, w1.y)) - 1;
    const maxY = Math.ceil(Math.max(w0.y, w1.y)) + 1;

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const v = grid.getPixel(x, y);
            if (v <= 0.001) continue;
            const s = this.worldToScreen(x - 0.5, y + 0.5);
            const size = cs;
            ctx.fillStyle = `rgba(52,152,219,${v})`;
            ctx.fillRect(s.x, s.y, size, size);
            if (cs >= 8) {
                ctx.strokeStyle = 'rgba(41,128,185,0.5)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(s.x, s.y, size, size);
            }
        }
    }
}
}

window.GridPainter = GridPainter;

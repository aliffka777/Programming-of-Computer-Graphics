/* Классы интерфейса растра, виртуальной сетки (массива пикселей) и логирования шагов вычислений */

class IRasterTarget {
    SetPixel(x, y, intensity = 1.0) {
        throw new Error('IRasterTarget.SetPixel() must be implemented');
    }
}

class VirtualGrid extends IRasterTarget {
    constructor(width, height) {
        super();
        this.width = width;
        this.height = height;
        this.data = new Float32Array(width * height);
    }

    SetPixel(x, y, intensity = 1.0) {
        const ix = (x + 0.5) | 0;
        const iy = (y + 0.5) | 0;
        if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
        const idx = iy * this.width + ix;
        const v = this.data[idx] + intensity;
        this.data[idx] = v > 1 ? 1 : v;
    }

    clear() {
        this.data.fill(0);
    }

    getPixel(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        return this.data[y * this.width + x];
    }
}

class Tracer {
    constructor() { this.lines = []; }
    log(msg) { this.lines.push(msg); }
    toString() { return this.lines.join('\n'); }
}

window.IRasterTarget = IRasterTarget;
window.VirtualGrid = VirtualGrid;
window.Tracer = Tracer;

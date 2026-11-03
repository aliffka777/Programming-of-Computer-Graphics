class Benchmark {
    constructor() {
        this.gridSize = 1024;
    }

    _newGrid() {
        return new VirtualGrid(this.gridSize, this.gridSize);
    }

    _randLine(minLen = 20, maxLen = 300) {
        const x1 = (Math.random() * (this.gridSize - maxLen)) | 0;
        const y1 = (Math.random() * (this.gridSize - maxLen)) | 0;
        const angle = Math.random() * Math.PI * 2;
        const len = minLen + Math.random() * (maxLen - minLen);
        const x2 = Math.round(x1 + len * Math.cos(angle));
        const y2 = Math.round(y1 + len * Math.sin(angle));
        return [x1, y1, x2, y2];
    }

    _randCircle() {
        const r = 5 + (Math.random() * 100) | 0;
        const cx = r + 5 + (Math.random() * (this.gridSize - 2 * r - 10)) | 0;
        const cy = r + 5 + (Math.random() * (this.gridSize - 2 * r - 10)) | 0;
        return [cx, cy, r];
    }

    timeLines(algorithmFn, count, minLen, maxLen) {
        const lines = new Array(count);
        for (let i = 0; i < count; i++) lines[i] = this._randLine(minLen, maxLen);

        const grid = this._newGrid();
        const target = grid;
        const t0 = performance.now();
        for (let i = 0; i < count; i++) {
            const L = lines[i];
            algorithmFn(L[0], L[1], L[2], L[3], target, null);
        }
        const t1 = performance.now();
        return { time: t1 - t0, grid };
    }

    timeCircles(algorithmFn, count) {
        const circles = new Array(count);
        for (let i = 0; i < count; i++) circles[i] = this._randCircle();

        const grid = this._newGrid();
        const t0 = performance.now();
        for (let i = 0; i < count; i++) {
            const C = circles[i];
            algorithmFn(C[0], C[1], C[2], grid, null);
        }
        const t1 = performance.now();
        return { time: t1 - t0, grid };
    }

    async runAll(lineCount, circleCount, statusCb) {
        const R = window.RasterEngine;
        const results = {
            lines: {},
            circles: {},
            countDependence: null,
            lengthDependence: null
        };

        const lineAlgos = {
            step:      R.stepLine.bind(R),
            dda:       R.ddaLine.bind(R),
            bresenham: R.bresenhamLine.bind(R),
            wu:        R.wuLine.bind(R)
        };

        for (const [name, fn] of Object.entries(lineAlgos)) {
            statusCb && statusCb(`Отрезки (${lineCount}): ${name}…`);
            await this._yield();
            const r = this.timeLines(fn, lineCount, 20, 300);
            results.lines[name] = r.time;
        }

        statusCb && statusCb(`Окружности (${circleCount}): bresenham…`);
        await this._yield();
        results.circles.bresenham = this.timeCircles(R.bresenhamCircle.bind(R), circleCount).time;

        statusCb && statusCb(`Окружности (${circleCount}): castle-pitway…`);
        await this._yield();
        results.circles.castle = this.timeCircles(
            (cx, cy, r, target) => R.castlePitwayEllipse(cx, cy, r, r, target, null),
            Math.max(1000, circleCount / 5)
        ).time;

        statusCb && statusCb('Зависимость от количества…');
        const counts = [10000, 25000, 50000, 75000, 100000];
        const countResults = {
            counts,
            step: [], dda: [], bresenham: [], wu: []
        };
        for (const c of counts) {
            for (const [name, fn] of Object.entries(lineAlgos)) {
                await this._yield();
                countResults[name].push(this.timeLines(fn, c, 20, 300).time);
            }
        }
        results.countDependence = countResults;

        statusCb && statusCb('Зависимость от длины линии…');
        const lengths = [10, 25, 50, 100, 200, 400];
        const lenResults = {
            lengths,
            step: [], dda: [], bresenham: [], wu: []
        };
        const N = 10000;
        for (const L of lengths) {
            for (const [name, fn] of Object.entries(lineAlgos)) {
                await this._yield();
                lenResults[name].push(this.timeLines(fn, N, L, L + 1).time);
            }
        }
        results.lengthDependence = lenResults;

        return results;
    }

    _yield() {
        return new Promise(r => setTimeout(r, 0));
    }
}

class Chart {
    static bar(canvas, labels, series, colors, yLabel) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const padL = 70, padR = 20, padT = 20, padB = 50;
        const cw = W - padL - padR;
        const ch = H - padT - padB;

        const maxVal = Math.max(...series.flat(), 1);
        const step = Chart._niceStep(maxVal);
        const top = Math.ceil(maxVal / step) * step;

        ctx.font = '11px Segoe UI';
        ctx.fillStyle = '#555';
        ctx.strokeStyle = '#eee';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let v = 0; v <= top + 0.0001; v += step) {
            const y = padT + ch - (v / top) * ch;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cw, y); ctx.stroke();
            ctx.fillText(v.toFixed(step < 1 ? 2 : 0), padL - 6, y);
        }

        ctx.save();
        ctx.translate(16, padT + ch / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 12px Segoe UI';
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();

        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + ch);
        ctx.lineTo(padL + cw, padT + ch);
        ctx.stroke();

        const n = labels.length;
        const barW = cw / n * 0.7;
        labels.forEach((label, i) => {
            const x = padL + (cw / n) * (i + 0.5);
            const v = series[i];
            const h = (v / top) * ch;
            ctx.fillStyle = colors[i];
            ctx.fillRect(x - barW / 2, padT + ch - h, barW, h);
            ctx.fillStyle = '#2c3e50';
            ctx.font = '11px Segoe UI';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(v.toFixed(0), x, padT + ch - h - 3);
            ctx.textBaseline = 'top';
            ctx.fillText(label, x, padT + ch + 6);
        });
    }

    static line(canvas, xLabels, seriesDict, colors, xLabel, yLabel) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const padL = 70, padR = 20, padT = 20, padB = 50;
        const cw = W - padL - padR;
        const ch = H - padT - padB;

        let maxY = 0, maxX = 0;
        for (const arr of Object.values(seriesDict))
            for (const v of arr) if (v > maxY) maxY = v;
        for (const x of xLabels) if (x > maxX) maxX = x;
        if (maxY === 0) maxY = 1;

        const yStep = Chart._niceStep(maxY);
        const yTop = Math.ceil(maxY / yStep) * yStep;

        ctx.strokeStyle = '#eee';
        ctx.fillStyle = '#555';
        ctx.font = '11px Segoe UI';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let v = 0; v <= yTop + 1e-6; v += yStep) {
            const y = padT + ch - (v / yTop) * ch;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cw, y); ctx.stroke();
            ctx.fillText(v.toFixed(yStep < 1 ? 2 : 0), padL - 6, y);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const logX = maxX > 5000;
        const xCoord = (x) => logX
            ? padL + (Math.log10(x) / Math.log10(maxX)) * cw
            : padL + (x / maxX) * cw;
        xLabels.forEach(x => {
            const px = xCoord(x);
            ctx.fillText(x >= 1000 ? (x / 1000) + 'k' : x, px, padT + ch + 6);
        });

        ctx.save();
        ctx.translate(16, padT + ch / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 12px Segoe UI';
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 12px Segoe UI';
        ctx.textBaseline = 'bottom';
        ctx.fillText(xLabel, padL + cw / 2, H - 6);

        ctx.strokeStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + ch);
        ctx.lineTo(padL + cw, padT + ch);
        ctx.stroke();

        let colorIdx = 0;
        for (const [name, arr] of Object.entries(seriesDict)) {
            ctx.strokeStyle = colors[colorIdx % colors.length];
            ctx.fillStyle = colors[colorIdx % colors.length];
            ctx.lineWidth = 2;
            ctx.beginPath();
            arr.forEach((v, i) => {
                const px = xCoord(xLabels[i]);
                const py = padT + ch - (v / yTop) * ch;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
            ctx.stroke();
            arr.forEach((v, i) => {
                const px = xCoord(xLabels[i]);
                const py = padT + ch - (v / yTop) * ch;
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            });
            colorIdx++;
        }

        let ly = padT + 5;
        colorIdx = 0;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (const name of Object.keys(seriesDict)) {
            ctx.fillStyle = colors[colorIdx % colors.length];
            ctx.fillRect(padL + cw - 100, ly, 12, 12);
            ctx.fillStyle = '#2c3e50';
            ctx.font = '11px Segoe UI';
            ctx.fillText(name, padL + cw - 84, ly + 6);
            ly += 16;
            colorIdx++;
        }
    }

    static _niceStep(maxVal) {
        const raw = maxVal / 5;
        const exp = Math.floor(Math.log10(raw));
        const f = raw / Math.pow(10, exp);
        let nice;
        if (f < 1.5) nice = 1;
        else if (f < 3) nice = 2;
        else if (f < 7) nice = 5;
        else nice = 10;
        return nice * Math.pow(10, exp);
    }
}

window.Benchmark = Benchmark;
window.Chart = Chart;
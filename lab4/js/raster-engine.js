const RasterEngine = {
    stepLine(x1, y1, x2, y2, target, tracer) {
        const log = (m) => tracer && tracer.log(m);
        log(`Пошаговый алгоритм: (${x1},${y1}) → (${x2},${y2})`);
        const dx = x2 - x1, dy = y2 - y1;
        log(`dx = ${dx}, dy = ${dy}`);

        if (dx === 0 && dy === 0) {
            target.SetPixel(x1, y1, 1); return;
        }

        if (Math.abs(dx) >= Math.abs(dy)) {
            const step = dx > 0 ? 1 : -1;
            const k = dy / dx;
            log(`|dx|>=|dy| → шагаем по X, k = ${k.toFixed(4)}`);
            for (let x = x1; ; x += step) {
                const y = Math.round(y1 + k * (x - x1));
                target.SetPixel(x, y, 1);
                if (tracer && Math.abs(x - x1) < 20) log(`  x=${x} → y≈${y}`);
                if (x === x2) break;
            }
        } else {
            const step = dy > 0 ? 1 : -1;
            const k = dx / dy;
            log(`|dy|>|dx| → шагаем по Y, k = ${k.toFixed(4)}`);
            for (let y = y1; ; y += step) {
                const x = Math.round(x1 + k * (y - y1));
                target.SetPixel(x, y, 1);
                if (tracer && Math.abs(y - y1) < 20) log(`  y=${y} → x≈${x}`);
                if (y === y2) break;
            }
        }
    },

    ddaLine(x1, y1, x2, y2, target, tracer) {
        const log = (m) => tracer && tracer.log(m);
        log(`ЦДА: (${x1},${y1}) → (${x2},${y2})`);
        const dx = x2 - x1, dy = y2 - y1;
        const n = Math.max(Math.abs(dx), Math.abs(dy));
        log(`dx=${dx}, dy=${dy}, n=${n}`);

        if (n === 0) { target.SetPixel(x1, y1, 1); return; }

        const xInc = dx / n, yInc = dy / n;
        log(`xInc=${xInc.toFixed(6)}, yInc=${yInc.toFixed(6)}`);

        let x = x1, y = y1;
        for (let i = 0; i <= n; i++) {
            const px = Math.round(x), py = Math.round(y);
            target.SetPixel(px, py, 1);
            if (tracer && i < 20) log(`  шаг ${i}: (${x.toFixed(3)}, ${y.toFixed(3)}) → (${px},${py})`);
            x += xInc; y += yInc;
        }
    },

    bresenhamLine(x1, y1, x2, y2, target, tracer) {
        const log = (m) => tracer && tracer.log(m);
        log(`Брезенхем (линия): (${x1},${y1}) → (${x2},${y2})`);

        let x = x1, y = y1;
        const dx = Math.abs(x2 - x1);
        const sx = x1 < x2 ? 1 : -1;
        const dy = -Math.abs(y2 - y1);
        const sy = y1 < y2 ? 1 : -1;
        let err = dx + dy;

        log(`dx=${dx}, sx=${sx}, dy=${dy}, sy=${sy}, err₀=${err}`);

        let step = 0;
        while (true) {
            target.SetPixel(x, y, 1);
            if (tracer && step < 20) log(`  шаг ${step}: (${x},${y}), err=${err}`);
            if (x === x2 && y === y2) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x += sx; }
            if (e2 <= dx) { err += dx; y += sy; }
            step++;
        }
        log(`Всего шагов: ${step + 1}`);
    },

    bresenhamCircle(cx, cy, r, target, tracer) {
        if (r <= 0) { target.SetPixel(cx, cy, 1); return; }
        const log = (m) => tracer && tracer.log(m);
        log(`Брезенхем (окружность): центр (${cx},${cy}), R=${r}`);

        let x = 0, y = r;
        let d = 3 - 2 * r;
        log(`x=0, y=${r}, d=${d}`);

        const plot8 = (x, y) => {
            target.SetPixel(cx + x, cy + y, 1);
            target.SetPixel(cx - x, cy + y, 1);
            target.SetPixel(cx + x, cy - y, 1);
            target.SetPixel(cx - x, cy - y, 1);
            target.SetPixel(cx + y, cy + x, 1);
            target.SetPixel(cx - y, cy + x, 1);
            target.SetPixel(cx + y, cy - x, 1);
            target.SetPixel(cx - y, cy - x, 1);
        };

        plot8(x, y);
        let step = 0;
        while (y >= x) {
            x++;
            if (d > 0) { y--; d += 4 * (x - y) + 10; }
            else       { d += 4 * x + 6; }
            plot8(x, y);
            if (tracer && step < 15) log(`  шаг ${step + 1}: x=${x}, y=${y}, d=${d}`);
            step++;
        }
    },

    wuLine(x1, y1, x2, y2, target, tracer) {
        const log = (m) => tracer && tracer.log(m);
        log(`Ву (сглаженная линия): (${x1},${y1}) → (${x2},${y2})`);

        if (x1 === x2 && y1 === y2) { target.SetPixel(x1, y1, 1); return; }

        const fpart  = (v) => v - Math.floor(v);
        const rfpart = (v) => 1 - fpart(v);

        let steep = Math.abs(y2 - y1) > Math.abs(x2 - x1);
        let a0 = x1, b0 = y1, a1 = x2, b1 = y2;
        if (steep) { [a0, b0] = [b0, a0]; [a1, b1] = [b1, a1]; }
        if (a0 > a1) { [a0, a1] = [a1, a0]; [b0, b1] = [b1, b0]; }

        const dx = a1 - a0;
        const dy = b1 - b0;
        const gradient = dx === 0 ? 1 : dy / dx;
        log(`steep=${steep}, dx=${dx}, dy=${dy}, gradient=${gradient.toFixed(4)}`);

        const plot = (x, y, alpha) => {
            if (alpha <= 0.0001) return;
            if (alpha > 1) alpha = 1;
            if (steep) target.SetPixel(y, x, alpha);
            else       target.SetPixel(x, y, alpha);
        };

        let xend = Math.round(a0);
        let yend = b0 + gradient * (xend - a0);
        let xgap = rfpart(a0 + 0.5);
        let xpxl1 = xend, ypxl1 = Math.floor(yend);
        plot(xpxl1, ypxl1,     rfpart(yend) * xgap);
        plot(xpxl1, ypxl1 + 1, fpart(yend)  * xgap);
        if (tracer) log(`  старт: x=${xpxl1}, yend=${yend.toFixed(3)}, xgap=${xgap.toFixed(3)}`);
        let intery = yend + gradient;

        xend = Math.round(a1);
        yend = b1 + gradient * (xend - a1);
        xgap = fpart(a1 + 0.5);
        const xpxl2 = xend, ypxl2 = Math.floor(yend);
        plot(xpxl2, ypxl2,     rfpart(yend) * xgap);
        plot(xpxl2, ypxl2 + 1, fpart(yend)  * xgap);

        for (let x = xpxl1 + 1; x < xpxl2; x++) {
            plot(x, Math.floor(intery),     rfpart(intery));
            plot(x, Math.floor(intery) + 1, fpart(intery));
            if (tracer && x - xpxl1 < 15)
                log(`  x=${x}, intery=${intery.toFixed(3)} → α₁=${rfpart(intery).toFixed(3)}, α₂=${fpart(intery).toFixed(3)}`);
            intery += gradient;
        }
    },

    castlePitwayEllipse(cx, cy, a, b, target, tracer) {
        if (a <= 0 || b <= 0) return;
        const log = (m) => tracer && tracer.log(m);
        log(`Кастла-Питвея (эллипс): центр (${cx},${cy}), a=${a}, b=${b}`);

        const x0 = cx - a, y0 = cy - b;
        const x1 = cx + a, y1 = cy + b;

        let aa = Math.abs(x1 - x0), bb = Math.abs(y1 - y0), b1 = bb & 1;
        let dx = 4 * (1 - aa) * bb * bb;
        let dy = 4 * (b1 + 1) * aa * aa;
        let err = dx + dy + b1 * aa * aa;

        let X0 = x0, X1 = x1, Y0 = y0;
        if (x0 > x1) { X0 = x1; X1 = x0 + aa; }
        if (y0 > y1) Y0 = y1;
        Y0 += (bb + 1) >> 1;
        let Y1 = Y0 - b1;

        aa *= 8 * aa;
        b1 = 8 * bb * bb;

        let step = 0;
        do {
            target.SetPixel(X1, Y0, 1);
            target.SetPixel(X0, Y0, 1);
            target.SetPixel(X0, Y1, 1);
            target.SetPixel(X1, Y1, 1);

            if (tracer && step < 15) log(`  шаг ${step + 1}: X0=${X0}, X1=${X1}, Y0=${Y0}, Y1=${Y1}, err=${err}`);

            let e2 = 2 * err;
            if (e2 >= dx) {
                X0++;
                X1--;
                dx += b1;
                err += dx;
            }
            if (e2 <= dy) {
                Y0++;
                Y1--;
                dy += aa;
                err += dy;
            }
            step++;
        } while (X0 <= X1);

        while (Y0 - Y1 <= bb) {
            target.SetPixel(X0 - 1, Y0, 1);
            target.SetPixel(X1 + 1, Y0, 1);
            target.SetPixel(X0 - 1, Y1, 1);
            target.SetPixel(X1 + 1, Y1, 1);
            Y0++;
            Y1--;
        }
    }
};
window.RasterEngine = RasterEngine;
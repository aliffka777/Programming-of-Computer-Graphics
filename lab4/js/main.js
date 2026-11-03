/* Инициализация интерфейса веб-приложения, обработка событий, запуск алгоритмов и бенчмарка */

const canvas      = document.getElementById('raster-canvas');
const painter     = new GridPainter(canvas);
const algorithmSel = document.getElementById('algorithm');
const drawBtn     = document.getElementById('draw-btn');
const clearBtn    = document.getElementById('clear-btn');
const zoomInBtn   = document.getElementById('zoom-in');
const zoomOutBtn  = document.getElementById('zoom-out');
const resetBtn    = document.getElementById('reset-view');
const zoomLabel   = document.getElementById('zoom-level');
const calcDiv     = document.getElementById('calculation-steps');
const perfDiv     = document.getElementById('performance');

const $ = id => document.getElementById(id);
const lineParams    = $('line-params');
const circleParams  = $('circle-params');
const ellipseParams = $('ellipse-params');

const VGRID_W = 400, VGRID_H = 400, VGRID_OFF = 200;
let currentGrid = null;

painter.redraw(null);
zoomLabel.textContent = '100%';

algorithmSel.addEventListener('change', () => {
    const v = algorithmSel.value;
    lineParams.style.display = (v === 'bresenham-circle' || v === 'castle-pitway') ? 'none' : '';
    circleParams.style.display  = (v === 'bresenham-circle') ? '' : 'none';
    ellipseParams.style.display = (v === 'castle-pitway') ? '' : 'none';    
});

zoomInBtn.onclick  = () => zoomLabel.textContent = Math.round(painter.zoom(1.25) * 100) + '%';
zoomOutBtn.onclick = () => zoomLabel.textContent = Math.round(painter.zoom(0.8) * 100) + '%';
resetBtn.onclick = () => { painter.reset(); zoomLabel.textContent = '100%'; };

clearBtn.onclick = () => {
    currentGrid = null;
    painter.redraw(null);
    calcDiv.textContent = '';
    perfDiv.textContent = '';
};

drawBtn.onclick = () => {
    const algo = algorithmSel.value;
    const grid = new VirtualGrid(VGRID_W, VGRID_H);
    const tracer = new Tracer();

    const target = {
        SetPixel(x, y, intensity) {
            grid.SetPixel(x + VGRID_OFF, y + VGRID_OFF, intensity);
        }
    };

    const visGrid = new VirtualGrid(VGRID_W, VGRID_H);
    const visTarget = {
        SetPixel(x, y, intensity) {
            visGrid.SetPixel(x + VGRID_OFF, y + VGRID_OFF, intensity);
        }
    };

    const t0 = performance.now();
    try {
        switch (algo) {
            case 'step':              RasterEngine.stepLine(+$('x1').value, +$('y1').value, +$('x2').value, +$('y2').value, visTarget, tracer); break;
            case 'dda':               RasterEngine.ddaLine(+$('x1').value, +$('y1').value, +$('x2').value, +$('y2').value, visTarget, tracer); break;
            case 'bresenham':         RasterEngine.bresenhamLine(+$('x1').value, +$('y1').value, +$('x2').value, +$('y2').value, visTarget, tracer); break;
            case 'bresenham-circle':  RasterEngine.bresenhamCircle(+$('cx').value, +$('cy').value, +$('radius').value, visTarget, tracer); break;
            case 'wu':                RasterEngine.wuLine(+$('x1').value, +$('y1').value, +$('x2').value, +$('y2').value, visTarget, tracer); break;
            case 'castle-pitway':     RasterEngine.castlePitwayEllipse(+$('ex').value, +$('ey').value, +$('ea').value, +$('eb').value, visTarget, tracer); break;
        }
    } catch (e) {
        perfDiv.textContent = 'Ошибка: ' + e.message;
        return;
    }
    const t1 = performance.now();

    perfDiv.textContent = `Время: ${(t1 - t0).toFixed(3)} мс`;
    calcDiv.textContent = tracer.toString() || '(вычисления не записаны)';

    currentGrid = {
        width: VGRID_W,
        height: VGRID_H,
        getPixel: (x, y) => visGrid.getPixel(x + VGRID_OFF, y + VGRID_OFF)
    };
    painter.redraw(currentGrid);
};

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    };
});

const runBtn      = $('run-benchmark');
const benchStatus = $('benchmark-status');
const benchResults= $('benchmark-results');
const bench       = new Benchmark();

runBtn.onclick = async () => {
    runBtn.disabled = true;
    const lineCount   = Math.max(1000, +$('bench-lines').value | 0);
    const circleCount = Math.max(1000, +$('bench-circles').value | 0);

    const tbody = benchResults.querySelector('tbody');
    tbody.innerHTML = '';
    benchStatus.textContent = 'Запуск…';

    try {
        const res = await bench.runAll(lineCount, circleCount, s => {
            benchStatus.textContent = s;
        });

        const algoNames = { step: 'Пошаговый', dda: 'ЦДА', bresenham: 'Брезенхем', wu: 'Ву' };
        const rows = Object.entries(algoNames);
        for (const [key, label] of rows) {
            const lineT = res.lines[key];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${label}</td>
                <td>${lineT.toFixed(1)}</td>
                <td>-</td>
                <td>${(lineCount * 150 / lineT * 1000).toFixed(0)}</td>`;
            tbody.appendChild(tr);
        }
        tbody.insertAdjacentHTML('beforeend', `
            <tr><td>Брезенхем (окр.)</td><td>-</td><td>${res.circles.bresenham.toFixed(1)}</td><td>-</td></tr>
            <tr><td>Кастла-Питвея</td><td>-</td><td>${res.circles.castle.toFixed(1)}</td><td>-</td></tr>
        `);

        const colors = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6'];

        Chart.bar($('chart-algos'),
            ['Пошаговый', 'ЦДА', 'Брезен.', 'Ву', 'Окр. Брез.', 'Окр. Кастла'],
            [
                res.lines.step, res.lines.dda, res.lines.bresenham, res.lines.wu,
                res.circles.bresenham, res.circles.castle
            ],
            ['#3498db','#e67e22','#2ecc71','#9b59b6','#16a085','#c0392b'],
            'Время, мс'
        );

        const cd = res.countDependence;
        Chart.line($('chart-count'),
            cd.counts,
            { 'Пошаговый': cd.step, 'ЦДА': cd.dda, 'Брезенхем': cd.bresenham, 'Ву': cd.wu },
            colors,
            'Число отрезков', 'Время, мс'
        );

        const ld = res.lengthDependence;
        Chart.line($('chart-length'),
            ld.lengths,
            { 'Пошаговый': ld.step, 'ЦДА': ld.dda, 'Брезенхем': ld.bresenham, 'Ву': ld.wu },
            colors,
            'Длина линии, пикс', 'Время, мс'
        );

        benchStatus.textContent = 'Готово ✓';
    } catch (e) {
        console.error(e);
        benchStatus.textContent = 'Ошибка';
    } finally {
        runBtn.disabled = false;
    }
};

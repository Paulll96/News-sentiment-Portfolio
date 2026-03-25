import { useRef, useEffect } from 'react';

const Waves = ({
    lineColor = 'rgba(255, 255, 255, 0.1)',
    backgroundColor = 'transparent',
    waveSpeedX = 0.02,
    waveSpeedY = 0.01,
    waveAmpX = 40,
    waveAmpY = 20,
    friction = 0.9,
    tension = 0.01,
    maxCursorMove = 120,
    xGap = 12,
    yGap = 36,
}) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width = 0;
        let height = 0;
        let lines = [];
        let animationFrameId;

        const mouse = {
            x: -1000,
            y: -1000,
            lx: -1000,
            ly: -1000,
            vx: 0,
            vy: 0,
        };

        class Grad {
            constructor(x, y, z) {
                this.x = x;
                this.y = y;
                this.z = z;
            }
            dot2(x, y) {
                return this.x * x + this.y * y;
            }
        }

        class Noise {
            constructor(seed = 0) {
                this.grad3 = [
                    new Grad(1, 1, 0),
                    new Grad(-1, 1, 0),
                    new Grad(1, -1, 0),
                    new Grad(-1, -1, 0),
                    new Grad(1, 0, 1),
                    new Grad(-1, 0, 1),
                    new Grad(1, 0, -1),
                    new Grad(-1, 0, -1),
                    new Grad(0, 1, 1),
                    new Grad(0, -1, 1),
                    new Grad(0, 1, -1),
                    new Grad(0, -1, -1),
                ];
                this.p = [
                    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
                    36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
                    234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88,
                    237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134,
                    139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230,
                    220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1,
                    216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116,
                    188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124,
                    123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47,
                    16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
                    154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19,
                    98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228,
                    251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145,
                    235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84,
                    204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114,
                    67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
                ];
                this.perm = new Array(512);
                this.gradP = new Array(512);
                this.seed(seed);
            }
            seed(seed) {
                if (seed > 0 && seed < 1) {
                    seed *= 65536;
                }
                seed = Math.floor(seed);
                if (seed < 256) {
                    seed |= seed << 8;
                }
                for (let i = 0; i < 256; i++) {
                    let v;
                    if (i & 1) {
                        v = this.p[i] ^ (seed & 255);
                    } else {
                        v = this.p[i] ^ ((seed >> 8) & 255);
                    }
                    this.perm[i] = this.perm[i + 256] = v;
                    this.gradP[i] = this.gradP[i + 256] = this.grad3[v % 12];
                }
            }
            simplex2(xin, yin) {
                let n0, n1, n2;
                const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
                const s = (xin + yin) * F2;
                const i = Math.floor(xin + s);
                const j = Math.floor(yin + s);
                const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
                const t = (i + j) * G2;
                const X0 = i - t;
                const Y0 = j - t;
                const x0 = xin - X0;
                const y0 = yin - Y0;

                let i1, j1;
                if (x0 > y0) {
                    i1 = 1;
                    j1 = 0;
                } else {
                    i1 = 0;
                    j1 = 1;
                }

                const x1 = x0 - i1 + G2;
                const y1 = y0 - j1 + G2;
                const x2 = x0 - 1.0 + 2.0 * G2;
                const y2 = y0 - 1.0 + 2.0 * G2;

                const ii = i & 255;
                const jj = j & 255;

                let t0 = 0.5 - x0 * x0 - y0 * y0;
                if (t0 < 0) n0 = 0.0;
                else {
                    t0 *= t0;
                    n0 = t0 * t0 * this.gradP[ii + this.perm[jj]].dot2(x0, y0);
                }

                let t1 = 0.5 - x1 * x1 - y1 * y1;
                if (t1 < 0) n1 = 0.0;
                else {
                    t1 *= t1;
                    n1 = t1 * t1 * this.gradP[ii + i1 + this.perm[jj + j1]].dot2(x1, y1);
                }

                let t2 = 0.5 - x2 * x2 - y2 * y2;
                if (t2 < 0) n2 = 0.0;
                else {
                    t2 *= t2;
                    n2 = t2 * t2 * this.gradP[ii + 1 + this.perm[jj + 1]].dot2(x2, y2);
                }

                return 70.0 * (n0 + n1 + n2);
            }
        }

        const noise = new Noise(Math.random());

        const initCanvas = () => {
            width = containerRef.current.clientWidth;
            height = containerRef.current.clientHeight;

            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';

            createLines();
        };

        const createLines = () => {
            lines = [];
            const numLines = Math.ceil(height / yGap) + 1;
            for (let i = 0; i <= numLines; i++) {
                lines.push({
                    y: i * yGap - yGap / 2,
                    points: [],
                });
            }

            for (let i = 0; i < lines.length; i++) {
                const numPoints = Math.ceil(width / xGap) + 1;
                for (let j = 0; j <= numPoints; j++) {
                    lines[i].points.push({
                        x: j * xGap - xGap / 2,
                        y: lines[i].y,
                        baseY: lines[i].y,
                        vy: 0,
                    });
                }
            }
        };

        const render = (time) => {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, width, height);

            mouse.vx = mouse.x - mouse.lx;
            mouse.vy = mouse.y - mouse.ly;
            mouse.lx = mouse.x;
            mouse.ly = mouse.y;

            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1;

            for (let i = 0; i < lines.length; i++) {
                ctx.beginPath();
                for (let j = 0; j < lines[i].points.length; j++) {
                    const pt = lines[i].points[j];

                    const n = noise.simplex2(
                        pt.x * waveSpeedX + time * 0.0002,
                        pt.y * waveSpeedY + time * 0.0002
                    );

                    let targetY = pt.baseY + n * waveAmpY;

                    const dx = mouse.x - pt.x;
                    const dy = mouse.y - pt.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < maxCursorMove) {
                        const force = (maxCursorMove - dist) / maxCursorMove;
                        targetY += mouse.vy * force * 0.5;
                    }

                    pt.vy += (targetY - pt.y) * tension;
                    pt.vy *= friction;
                    pt.y += pt.vy;

                    if (j === 0) {
                        ctx.moveTo(pt.x, pt.y);
                    } else {
                        ctx.lineTo(pt.x, pt.y);
                    }
                }
                ctx.stroke();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        const handleMouseMove = (e) => {
            const rect = containerRef.current.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        };

        const handleMouseLeave = () => {
            mouse.x = -1000;
            mouse.y = -1000;
        };

        window.addEventListener('resize', initCanvas);
        containerRef.current.addEventListener('mousemove', handleMouseMove);
        containerRef.current.addEventListener('mouseleave', handleMouseLeave);

        initCanvas();
        render(0);

        return () => {
            window.removeEventListener('resize', initCanvas);
            if (containerRef.current) {
                containerRef.current.removeEventListener('mousemove', handleMouseMove);
                containerRef.current.removeEventListener('mouseleave', handleMouseLeave);
            }
            cancelAnimationFrame(animationFrameId);
        };
    }, [
        lineColor,
        backgroundColor,
        waveSpeedX,
        waveSpeedY,
        waveAmpX,
        waveAmpY,
        friction,
        tension,
        maxCursorMove,
        xGap,
        yGap,
    ]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 0,
                pointerEvents: 'none',
                overflow: 'hidden'
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
    );
};

export default Waves;

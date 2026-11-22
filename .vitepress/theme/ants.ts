// The ants of the home page, shared by the trail above the ground (AntTrail.vue) and the tunnel
// under it (Underground.vue): the colors of the crumbs they carry, the curve they walk, and how an
// ant is drawn.

export const colors = ["#2563eb", "#7c3aed", "#f43f5e", "#f59e0b"];

// An ant that carries a crumb out of the tunnel hands it to the hill with this event on window;
// its detail is the crumb's color.
export const crumbEvent = "ant-lang:crumb";

export type Point = [number, number, number]; // x, y, and the trail's heading there

// A Catmull-Rom curve through the waypoints, sampled densely, with the distance walked to each
// sample. The curve swings wide at the corners; it is kept inside the width of the page.
export class Trail {
  readonly pts: [number, number][] = [];
  readonly lens: number[] = [0];
  readonly total: number = 0;
  static readonly n = 120;

  constructor(way: [number, number][], width: number) {
    const n = Trail.n;
    for (let i = 0; i < way.length - 1; i++) {
      const p0 = way[Math.max(0, i - 1)];
      const p1 = way[i];
      const p2 = way[i + 1];
      const p3 = way[Math.min(way.length - 1, i + 2)];
      for (let j = 0; j < n; j++) {
        const t = j / n;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        this.pts.push([
          Math.max(12, Math.min(width - 12, f(p0[0], p1[0], p2[0], p3[0]))),
          f(p0[1], p1[1], p2[1], p3[1]),
        ]);
      }
    }
    if (way.length) this.pts.push(way[way.length - 1]);
    let total = 0;
    for (let i = 1; i < this.pts.length; i++) {
      total += Math.hypot(this.pts[i][0] - this.pts[i - 1][0], this.pts[i][1] - this.pts[i - 1][1]);
      this.lens.push(total);
    }
    this.total = total;
  }

  // The distance along the trail to the waypoint at index i.
  to(i: number): number {
    return this.lens[Math.min(this.lens.length - 1, i * Trail.n)];
  }

  // Where the trail is after d, and which way it heads there.
  at(d: number): Point {
    const { pts, lens } = this;
    let lo = 0;
    let hi = lens.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lens[mid] < d) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const a = pts[i - 1];
    const b = pts[i];
    const k = Math.max(0, Math.min(1, (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1)));
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])];
  }
}

// An ant facing along heading, its legs at step t, and the crumb in its jaws if it has one.
export function drawAnt(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  t: number,
  crumb: string | null,
  alpha: number,
) {
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.rotate(heading);
  c.fillStyle = "#d6d6dc";
  c.strokeStyle = "#8a8a92";
  c.lineWidth = 0.7;
  const step = Math.sin(t) * 1.4;
  c.beginPath();
  for (const sx of [-2, 0, 2]) {
    const s = sx === 0 ? -step : step;
    c.moveTo(sx, 0);
    c.lineTo(sx + s, -3.6);
    c.moveTo(sx, 0);
    c.lineTo(sx - s, 3.6);
  }
  c.moveTo(3.6, -0.6);
  c.lineTo(5.8, -2.4 + step * 0.3);
  c.moveTo(3.6, 0.6);
  c.lineTo(5.8, 2.4 - step * 0.3);
  c.stroke();
  c.beginPath();
  c.ellipse(-3.6, 0, 2.4, 1.7, 0, 0, Math.PI * 2);
  c.ellipse(0, 0, 1.5, 1.1, 0, 0, Math.PI * 2);
  c.ellipse(2.6, 0, 1.4, 1.3, 0, 0, Math.PI * 2);
  c.fill();
  if (crumb) {
    c.fillStyle = crumb;
    c.beginPath();
    c.arc(5.6, 0, 1.7, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * An interactive dotted globe you can spin with the mouse/finger. Renders a
 * fibonacci-sphere of faint dots plus glowing markers at real cities, rotating
 * on its own and draggable with inertia. Pure canvas — no libraries, no assets,
 * self-contained. Skips the animation loop under prefers-reduced-motion.
 */

type City = { name: string; lat: number; lng: number };

const CITIES: City[] = [
  { name: "Nairobi", lat: -1.29, lng: 36.82 },
  { name: "Lagos", lat: 6.52, lng: 3.38 },
  { name: "Johannesburg", lat: -26.2, lng: 28.05 },
  { name: "Accra", lat: 5.6, lng: -0.19 },
  { name: "Cairo", lat: 30.04, lng: 31.24 },
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "Dubai", lat: 25.2, lng: 55.27 },
  { name: "Mumbai", lat: 19.08, lng: 72.88 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "New York", lat: 40.71, lng: -74.01 },
  { name: "São Paulo", lat: -23.55, lng: -46.63 },
  { name: "Sydney", lat: -33.87, lng: 151.21 },
];

const N_DOTS = 700;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function spherePoint(lat: number, lng: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
}

export function WorldGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; name: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Faint surface dots (fibonacci sphere).
    const dots: [number, number, number][] = [];
    for (let i = 0; i < N_DOTS; i++) {
      const y = 1 - (i / (N_DOTS - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = i * GOLDEN;
      dots.push([Math.cos(t) * r, y, Math.sin(t) * r]);
    }
    const cityPts = CITIES.map((c) => ({ c, p: spherePoint(c.lat, c.lng) }));

    let yaw = -0.4;
    let vel = 0.0016; // idle spin
    const tilt = -0.42;
    let dragging = false;
    let lastX = 0;
    let raf = 0;
    let size = 0;
    const markerScreen: { x: number; y: number; z: number; name: string }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const css = canvas.clientWidth;
      size = css;
      canvas.width = css * dpr;
      canvas.height = css * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const rot = (p: [number, number, number]) => {
      // yaw around Y, then fixed tilt around X
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const x1 = p[0] * cy - p[2] * sy;
      const z1 = p[0] * sy + p[2] * cy;
      const cx = Math.cos(tilt), sx = Math.sin(tilt);
      const y2 = p[1] * cx - z1 * sx;
      const z2 = p[1] * sx + z1 * cx;
      return [x1, y2, z2] as [number, number, number];
    };

    const draw = () => {
      const R = size / 2;
      const cx = R;
      const cy = R;
      const rad = R * 0.92;
      ctx.clearRect(0, 0, size, size);

      // soft glow behind
      const g = ctx.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad * 1.15);
      g.addColorStop(0, "rgba(0,223,164,0.10)");
      g.addColorStop(1, "rgba(0,223,164,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // surface dots
      for (const d of dots) {
        const [x, y, z] = rot(d);
        const depth = (z + 1) / 2; // 0 back .. 1 front
        const px = cx + x * rad;
        const py = cy - y * rad;
        const alpha = 0.08 + depth * 0.42;
        const r = 0.6 + depth * 1.1;
        ctx.fillStyle = `rgba(148,163,184,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // city markers
      markerScreen.length = 0;
      const now = performance.now();
      for (const { c, p } of cityPts) {
        const [x, y, z] = rot(p);
        const px = cx + x * rad;
        const py = cy - y * rad;
        markerScreen.push({ x: px, y: py, z, name: c.name });
        if (z < -0.1) continue; // behind the globe
        const front = (z + 1) / 2;
        const pulse = 0.5 + 0.5 * Math.sin(now / 500 + c.lng);
        // halo
        ctx.fillStyle = `rgba(47,240,189,${0.12 * front})`;
        ctx.beginPath();
        ctx.arc(px, py, 5 + pulse * 4, 0, Math.PI * 2);
        ctx.fill();
        // core
        ctx.fillStyle = `rgba(47,240,189,${0.6 + 0.4 * front})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!dragging) {
        yaw += vel;
        // ease idle velocity back toward the gentle default
        vel += (0.0016 - vel) * 0.02;
      }
      raf = requestAnimationFrame(draw);
    };

    if (reduce) {
      draw(); // one static frame
    } else {
      raf = requestAnimationFrame(draw);
    }

    // drag to spin
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        yaw += dx * 0.008;
        vel = dx * 0.0016; // fling → inertia
      } else {
        // hover detection over markers
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        let found: { x: number; y: number; name: string } | null = null;
        for (const m of markerScreen) {
          if (m.z < -0.1) continue;
          if (Math.hypot(mx - m.x, my - m.y) < 10) {
            found = { x: m.x, y: m.y, name: m.name };
            break;
          }
        }
        setHover(found);
      }
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", () => setHover(null));

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        style={{ width: "100%", height: "100%" }}
      />
      {hover && (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-ink-900/90 px-2 py-1 text-[11px] font-medium text-white backdrop-blur"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          {hover.name}
        </span>
      )}
    </div>
  );
}

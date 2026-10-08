"use client";

import { useEffect, useRef } from "react";
import { asmrParticleCount, asmrStepsPerFrame, asmrTrailAlpha } from "@/lib/landing-budget";
import { cn } from "@/lib/utils";

// Adapted from the ASMR static background demo: charcoal and glass shards that swirl toward the cursor.
// Changes: fills its positioned parent instead of the window, no hidden cursor or overlay text,
// particle count scales with area, pauses while off screen, one still frame under prefers-reduced-motion.
const MAGNETIC_RADIUS = 200;
const VORTEX_STRENGTH = 0.025;
const PULL_STRENGTH = 0.05;
const NARROW = "(max-width: 767px)";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  solid: string;
  rotation: number;
  rotationSpeed: number;
  glow: number;
};

function makeParticle(width: number, height: number): Particle {
  const glass = Math.random() > 0.7; // 70% charcoal, 30% glass
  const color = glass ? "240, 245, 255" : "80, 80, 85";
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.06,
    vy: (Math.random() - 0.5) * 0.06,
    size: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.4 + 0.1,
    color,
    solid: `rgb(${color})`,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.015,
    glow: 0,
  };
}

export function AsmrBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const host = canvas?.parentElement;
    if (!canvas || !ctx || !host) return;

    let width = (canvas.width = host.clientWidth);
    let height = (canvas.height = host.clientHeight);
    // ponytail: count fixed at mount size; re-seed on resize only if density looks off after rotation.
    // Phones keep the same density. A large narrow window is capped, and it draws every other
    // frame with two steps so the drift and the fade match the 60fps desktop loop.
    const narrow = window.matchMedia(NARROW).matches;
    const count = asmrParticleCount(width, height, narrow);
    const steps = asmrStepsPerFrame(narrow);
    const trail = `rgba(5, 5, 6, ${asmrTrailAlpha(narrow)})`;
    let gate = 0;
    const particles = Array.from({ length: count }, () => makeParticle(width, height));
    const mouse = { x: -1000, y: -1000 };
    // The swirl follows the cursor only while it moves, fading out shortly after it stops.
    let lastMove = 0;
    let activity = 0;
    const SETTLE_MS = 400;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    function update(p: Particle) {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (activity > 0 && dist > 0 && dist < MAGNETIC_RADIUS) {
        const force = ((MAGNETIC_RADIUS - dist) / MAGNETIC_RADIUS) * activity;
        p.vx += (dx / dist) * force * PULL_STRENGTH;
        p.vy += (dy / dist) * force * PULL_STRENGTH;
        // swirl perpendicular to the radius
        p.vx += (dy / dist) * force * VORTEX_STRENGTH * 10;
        p.vy -= (dx / dist) * force * VORTEX_STRENGTH * 10;
        p.glow = force * 0.4;
      } else {
        p.glow *= 0.92;
      }
      p.x += p.vx;
      p.y += p.vy;
      // Brake harder once the cursor is still, so leftover swirl stops instead of coasting.
      const friction = activity > 0 ? 0.95 : 0.85;
      p.vx = p.vx * friction + (Math.random() - 0.5) * 0.012;
      p.vy = p.vy * friction + (Math.random() - 0.5) * 0.012;
      p.rotation += p.rotationSpeed + (Math.abs(p.vx) + Math.abs(p.vy)) * 0.02;
      if (p.x < -20) p.x = width + 20;
      if (p.x > width + 20) p.x = -20;
      if (p.y < -20) p.y = height + 20;
      if (p.y > height + 20) p.y = -20;
    }

    // Same pixels as save/translate/rotate/restore with an rgba() string per particle, minus the per-frame
    // allocations: one transform call, the fixed colour plus globalAlpha. Glowing particles keep the rgba path
    // because globalAlpha would also scale their shadow.
    function draw(p: Particle) {
      const cos = Math.cos(p.rotation);
      const sin = Math.sin(p.rotation);
      ctx!.setTransform(cos, sin, -sin, cos, p.x, p.y);
      const alpha = Math.min(p.alpha + p.glow, 0.9);
      if (p.glow > 0.3) {
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = `rgba(${p.color}, ${alpha})`;
        ctx!.shadowBlur = 8 * p.glow;
        ctx!.shadowColor = `rgba(180, 220, 255, ${p.glow})`;
      } else {
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = p.solid;
        ctx!.shadowBlur = 0;
      }
      ctx!.beginPath();
      ctx!.moveTo(0, -p.size * 2.5);
      ctx!.lineTo(p.size, 0);
      ctx!.lineTo(0, p.size * 2.5);
      ctx!.lineTo(-p.size, 0);
      ctx!.closePath();
      ctx!.fill();
    }

    function resetState() {
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.globalAlpha = 1;
      ctx!.shadowBlur = 0;
    }

    function still() {
      ctx!.fillStyle = "#050506";
      ctx!.fillRect(0, 0, width, height);
      particles.forEach(draw);
      resetState();
    }

    function render() {
      if (narrow) {
        gate ^= 1;
        if (gate === 0) {
          frame = requestAnimationFrame(render);
          return;
        }
      }
      activity = Math.max(0, 1 - (performance.now() - lastMove) / SETTLE_MS);
      ctx!.fillStyle = trail;
      ctx!.fillRect(0, 0, width, height);
      for (const p of particles) {
        for (let i = 0; i < steps; i++) update(p);
        draw(p);
      }
      resetState();
      frame = requestAnimationFrame(render);
    }

    function start() {
      if (!frame) frame = requestAnimationFrame(render);
    }
    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    const resize = new ResizeObserver(() => {
      width = canvas.width = host.clientWidth;
      height = canvas.height = host.clientHeight;
      if (reduce) still();
    });
    resize.observe(host);

    function onMouse(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      lastMove = performance.now();
    }
    function onTouch(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      const r = canvas!.getBoundingClientRect();
      mouse.x = t.clientX - r.left;
      mouse.y = t.clientY - r.top;
      lastMove = performance.now();
    }

    if (reduce) {
      still();
      return () => resize.disconnect();
    }

    // Only animate while the host is on screen.
    const seen = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    seen.observe(host);
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("touchmove", onTouch, { passive: true });

    return () => {
      resize.disconnect();
      seen.disconnect();
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
      stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 block h-full w-full", className)}
    />
  );
}

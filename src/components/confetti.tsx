"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

// A burst of paper confetti for rare, finished moments (a download, the end of How it works). Put the returned
// element inside a positioned parent: the pieces fly up from its center. Hidden when motion is reduced.

const COLORS = ["#6f86ff", "#9b78f2", "#f08bbd", "#ffbd44", "#00c84e", "#ff625a"];
const LIFETIME_MS = 1700;

interface Particle { dx: number; apex: number; fall: number; dur: number; delay: number; spin: number; flip: number; r0: number; w: number; h: number; round: boolean; color: string }

// Thrown mostly upward: each piece rises and slows, then falls under gravity while tumbling.
function particles(count = 22): Particle[] {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  return Array.from({ length: count }, (_, i) => {
    const shape = i % 3;
    const side = i % 2 ? 1 : -1;
    return {
      dx: side * rand(18, 135), apex: -rand(72, 150), fall: rand(30, 90),
      dur: rand(1050, 1500), delay: rand(0, 60),
      spin: side * rand(240, 720), flip: rand(360, 1080), r0: rand(0, 360),
      w: shape === 0 ? rand(3.5, 4.5) : rand(5, 6.5), h: shape === 0 ? rand(8, 11) : rand(5, 6.5), round: shape === 2,
      color: COLORS[i % COLORS.length],
    };
  });
}

export function useConfetti() {
  const [burst, setBurst] = useState<{ id: number; particles: Particle[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const fire = useCallback(() => {
    setBurst(b => ({ id: (b?.id ?? 0) + 1, particles: particles() }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setBurst(null), LIFETIME_MS);
  }, []);

  const element = burst && <span className="confetti" key={burst.id} aria-hidden="true">
    {burst.particles.map((pt, i) => <i key={i} style={{ "--dx": `${pt.dx}px`, "--apex": `${pt.apex}px`, "--fall": `${pt.fall}px`, "--dur": `${pt.dur}ms`, "--delay": `${pt.delay}ms`,
      "--spin": `${pt.spin}deg`, "--flip": `${pt.flip}deg`, "--r0": `${pt.r0}deg` } as CSSProperties}>
      <b><s style={{ width: pt.w, height: pt.h, background: pt.color, borderRadius: pt.round ? "50%" : 1 }} /></b>
    </i>)}
  </span>;

  return [element, fire] as const;
}

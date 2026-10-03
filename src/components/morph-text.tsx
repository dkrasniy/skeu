"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Text that morphs between values by its shared letters, after Family's "Continue → Confirm":
// letters both strings have glide to their new places, the rest fade out and in.
// "Download PNG → JPG" keeps "Download", slides the P and G, and swaps only N for J.

const MOVE = { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
const ENTER = { duration: 250, delay: 60, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" as const };
const EXIT = { duration: 150, easing: "ease-out" };

export function MorphText({ text }: { text: string }) {
  const [initial] = useState(text);
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(initial);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!root.querySelector("span")) render(root, [...shown.current]);
    if (text === shown.current) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll("[data-exit]").forEach(el => el.remove());
    const before = [...root.children] as HTMLElement[];
    const from = before.map(el => el.getBoundingClientRect().left);
    const keep = matches(shown.current, text);
    shown.current = text;

    const after = [...text].map((ch, i) => {
      const old = keep.get(i);
      const el = old === undefined ? char(ch) : before[old];
      el.getAnimations().forEach(a => a.cancel());
      return el;
    });
    const kept = new Set(keep.values());
    const leaving = before.filter((_, i) => !kept.has(i));
    root.replaceChildren(...after);
    if (still) return;

    // Leavers stay where they were, out of the flow, while they fade.
    const origin = root.getBoundingClientRect().left;
    leaving.forEach(el => {
      const i = before.indexOf(el);
      el.dataset.exit = "";
      el.style.left = `${from[i] - origin}px`;
      root.append(el);
      el.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(2px)" }], EXIT).onfinish = () => el.remove();
    });
    after.forEach((el, i) => {
      const old = keep.get(i);
      if (old === undefined) {
        el.animate([{ opacity: 0, filter: "blur(2px)", transform: "translateY(3px)" }, { opacity: 1, filter: "blur(0)", transform: "none" }], ENTER);
      } else {
        const dx = from[old] - el.getBoundingClientRect().left;
        if (dx) el.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], MOVE);
      }
    });
  }, [text]);

  return <span className="morph-text">
    <span className="sr-only">{text}</span>
    <span ref={ref} className="morph-text-chars" aria-hidden="true">{initial}</span>
  </span>;
}

function render(root: HTMLElement, chars: string[]) {
  root.replaceChildren(...chars.map(char));
}

function char(ch: string) {
  const el = document.createElement("span");
  el.textContent = ch;
  return el;
}

// Pairs each letter of `b` with one of `a` along their longest common subsequence: new index → old index.
function matches(a: string, b: string) {
  const x = [...a], y = [...b];
  const table = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const pairs = new Map<number, number>();
  for (let i = 0, j = 0; i < x.length && j < y.length;) {
    if (x[i] === y[j]) { pairs.set(j, i); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

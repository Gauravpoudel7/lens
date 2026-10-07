"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

// Types the memo string out character by character once it scrolls into view.
export function MemoTyper({ text }: { text: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(text.length);

  useEffect(() => {
    if (!inView || reduce) return;
    let i = 0;
    setN(0);
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [inView, reduce, text]);

  return (
    <code ref={ref} className="block font-mono text-[13px] leading-relaxed break-all text-[#7cf7c4]">
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.slice(0, n)}
        <span className="ml-px inline-block h-[1.1em] w-[7px] translate-y-[3px] bg-[#7cf7c4]/80 motion-safe:animate-pulse" />
      </span>
    </code>
  );
}

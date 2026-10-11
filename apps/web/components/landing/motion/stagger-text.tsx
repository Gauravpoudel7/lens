"use client";

import { m } from "framer-motion";
import { EASE } from "./ease";

// Splits a heading into words that rise and sharpen in sequence when scrolled into view.
export function StaggerText({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <m.span
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ staggerChildren: 0.05 }}
    >
      <span className="sr-only">{text}</span>
      {words.map((word, i) => (
        <m.span
          key={i}
          aria-hidden
          className="word inline-block"
          variants={{
            hidden: { opacity: 0, y: "0.35em", filter: "blur(8px)" },
            show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: EASE } },
          }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </m.span>
      ))}
    </m.span>
  );
}

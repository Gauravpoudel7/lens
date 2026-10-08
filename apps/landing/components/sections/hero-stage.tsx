"use client";

import { useEffect, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";
import { m } from "framer-motion";
import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";
import { ApertureMark } from "@/components/logo";
import { EASE } from "@/components/motion/ease";
import { SPLINE_SCENE } from "@/content/copy";

export function HeroSpotlight() {
  return <Spotlight size={520} fill="rgb(255 255 255 / 0.10)" springOptions={{ bounce: 0, stiffness: 120, damping: 20 }} />;
}

// Static stand-in where the 3D scene never loads: small, low-memory, or reduced-motion devices.
function Poster() {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center">
      <div className="absolute size-[min(80%,420px)] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(153_69_255/0.35),transparent_60%),radial-gradient(circle_at_70%_75%,rgb(20_241_149/0.22),transparent_60%)] blur-2xl" />
      <div className="absolute size-[min(70%,340px)] rounded-full border border-white/10" />
      <div className="absolute size-[min(52%,250px)] rounded-full border border-white/[0.07]" />
      <ApertureMark className="spin-slow relative size-[min(34%,150px)] text-white/80" />
    </div>
  );
}

const REDUCE = "(prefers-reduced-motion: reduce)";
const NARROW = "(max-width: 767px)";

function canRun3D() {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return !matchMedia(REDUCE).matches && !matchMedia(NARROW).matches && !(mem !== undefined && mem < 4);
}

// Camera 2 in this scene: Spline's own intro pulls back from a head close-up (y 249, z 360) to the full
// body (y 147, z 1000), and the close-up crops the arms. The intro starts from wherever the camera is at
// load, so moving it to a mid shot on the same path keeps Spline's smooth pull-back without the crop.
function startMidShot(app: Application) {
  const cam = app.findObjectByName("Camera 2");
  if (!cam) return;
  cam.position.y = 173;
  cam.position.z = 840;
}

export function HeroStage() {
  // null until measured on the client, so desktop never flashes the poster.
  const [use3D, setUse3D] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  // Spline renders every frame even when nobody can see it; pause it while the hero is scrolled away.
  const stage = useRef<HTMLDivElement>(null);
  const app = useRef<Application | null>(null);
  const onScreen = useRef(true);

  // Re-check on breakpoint or motion-setting changes, e.g. browser zoom crossing 768px.
  useEffect(() => {
    const update = () => {
      const ok = canRun3D();
      setUse3D(ok);
      if (!ok) {
        setReady(false); // a remount fades in again after its own load
        app.current = null; // the unmounted scene is disposed
      }
    };
    update();
    const queries = [matchMedia(REDUCE), matchMedia(NARROW)];
    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting;
      if (entry.isIntersecting) app.current?.play();
      else app.current?.stop();
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={stage} role="img" aria-label="Lens, shown as a 3D analyst that follows your cursor" className="relative h-[320px] w-full md:h-full">
      {use3D === false && <Poster />}
      {use3D && (
        // The scene scales with canvas height, so height follows width here; otherwise the hands crop.
        // -left-12 gives the hands room when the robot turns; the canvas is transparent and sits under the text column.
        // Centered vertically so the head sits level with the headline; the bottom fades so the legs don't end on a hard edge.
        <m.div
          aria-hidden
          className="absolute top-1/2 right-0 -left-12 aspect-square max-h-full -translate-y-1/2 [mask-image:linear-gradient(to_bottom,#000_72%,transparent_96%)]"
          initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(8px)" }}
          animate={ready ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined}
          transition={{ duration: 1.2, ease: EASE }}
        >
          <SplineScene
            scene={SPLINE_SCENE}
            className="h-full w-full"
            onLoad={(spline) => {
              // Follow the cursor anywhere on the page, not only over the canvas (the text column sits on top of it).
              spline.setGlobalEvents(true);
              startMidShot(spline);
              setReady(true);
              app.current = spline;
              if (!onScreen.current) spline.stop();
            }}
          />
        </m.div>
      )}
    </div>
  );
}

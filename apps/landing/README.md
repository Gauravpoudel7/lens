# @lens/landing

Marketing page for Lens. Static Next.js (App Router) + TypeScript + Tailwind v4 + shadcn primitives + framer-motion. Port 3848.

```bash
cp apps/landing/.env.example apps/landing/.env.local   # optional
npm run dev:landing            # http://127.0.0.1:3848
npm run build:landing
```

It never calls an API, a wallet, or X. Links into the scorecard use `NEXT_PUBLIC_APP_URL`.

## Layout

```
app/                  layout (fonts, metadata, MotionProvider), page, OG image, icon, sitemap, robots
components/ui/        shadcn-style primitives: splite, spotlight, card, button, badge, sheet, asmr-background (page particles)
components/sections/  one file per page section, in page order
components/motion/    reveal, stagger-text, counter, marquee, magnetic, glow-card, pause-region
content/              all copy. placeholders.ts holds every made-up number and quote
design-system/lens/   UI UX Pro Max output plus the Lens decisions on top of it
```

## Why `components/ui` matters

`components.json` maps the shadcn `ui` alias to `@/components/ui`. The shadcn CLI writes every primitive there, and the Spline spec imports `@/components/ui/splite`, `@/components/ui/card`, and `@/components/ui/spotlight`. If the folder or alias moves, those imports break, `npx shadcn add` drops files somewhere else, and you end up with two copies of each primitive. Keep primitives in `components/ui`, sections in `components/sections`, and motion helpers in `components/motion`. `lib/utils.ts` exports `cn()`, which the primitives import.

## Changes from the Spline component spec

- `spotlight.tsx` accepts `fill` (the spec demo passes it; the original props did not), removes the same listener functions it adds, and uses `m.div` so it works inside `LazyMotion strict`.
- `.loader` (the Suspense fallback) is defined in `app/globals.css`.
- The 3D scene mounts only when the hero is in view, and never under reduced motion, under 768 px, or when `navigator.deviceMemory < 4`. A CSS poster shows instead. If the scene file is blocked or fails to load, the same poster shows and the rest of the page stays up. A load that finishes after the robot was hidden is ignored.
- `splite.tsx` takes an optional `onLoad(app)`. The hero uses it to move `Camera 2` to a mid shot before Spline’s own intro pull-back starts (its default head close-up crops the arms) and to turn on global events so the head follows the cursor over the text column too. If you swap the scene, update the camera name and position in `hero-stage.tsx`.
- The scene file is preloaded only when the viewport is at least 768px wide and the user does not prefer reduced motion. Phones and reduced-motion desktops do not download it.
- `splite-demo.tsx` is the spec demo kept for reference. It is not on the page.

## Copy rules

Same as the bot: no “scam”, no buy/sell instruction or price talk, every example reply ends with “Not financial advice.”, examples are labeled, placeholder numbers are tagged.

## Before launch

- Replace the sample posts in `content/placeholders.ts` with real posts (with permission).
- Swap `SPLINE_SCENE` in `content/copy.ts` for a Lens scene.
- Set `NEXT_PUBLIC_SITE_URL` and the footer `// TODO` links (docs, GitHub).

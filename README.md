# ryan-reisdorf.github.io

Personal portfolio. Astro + TypeScript, plain CSS, no UI framework, no Tailwind.
Statically generated and deployed to GitHub Pages on every push to `main`.

**Visual direction — "Console":** Anduril-style structure (near-black ground,
hairline rules, square corners, uppercase micro-labels, dense technical
metadata) with a neo-retro CRT texture (monospace display type, scanlines, a
faint phosphor grid, corner brackets) and a pinch of cyber-Tokyo neon
(phosphor cyan as the signal colour, hot magenta used sparingly).

**Stack:** Astro 7 · TypeScript (strict) · pnpm · zero client JS except one 1.1 KB
inlined script for tag filtering.

---

## Local development

Requires Node ≥ 22.12 and pnpm. (This machine has Node 24 LTS installed at
`~/.local/node`, symlinked into `~/.local/bin` — already on your `PATH`.)

```sh
pnpm install          # install dependencies
pnpm dev              # dev server at http://localhost:4321
pnpm build            # production build into dist/
pnpm preview          # serve dist/ locally, exactly as Pages will
pnpm verify           # token lint + typecheck + build — run before pushing
```

Individual checks:

```sh
pnpm run lint:tokens  # fails if a literal color/font/px-font-size escaped tokens.css
pnpm run check        # astro check (TypeScript + template diagnostics)
```

> **TypeScript is pinned to 6.x on purpose.** TS 7's native compiler doesn't yet
> expose the programmatic API `astro check` needs. Don't bump it to 7 until
> [withastro/roadmap#1321](https://github.com/withastro/roadmap/discussions/1321)
> closes.

### Project structure

```
src/
  content.config.ts        zod schema for the projects collection
  content/projects/*.md    one file per project
  data/site.ts             site metadata, nav, and the /links hub
  data/resume.ts           résumé content — single source of truth
  lib/projects.ts          collection queries + draft filtering (use these, not getCollection)
  layouts/BaseLayout.astro meta tags, OG, landmarks, skip link
  components/              Header, Footer, ProjectCard, ProjectBrowser
  pages/                   index, projects/, resume, links, 404, rss.xml
  styles/tokens.css        every design value, defined once
  styles/global.css        element defaults + shared primitives
public/                    resume.pdf, favicon, og-default.png, robots.txt
scripts/check-tokens.mjs   enforces the theming rule
.github/workflows/deploy.yml
```

---

## Adding a project

Create `src/content/projects/my-project.md`. The filename becomes the URL:
`/projects/my-project`.

```markdown
---
title: 'Thing I Built'
summary: 'One or two sentences. Used on cards, in meta descriptions, and in RSS.'
tags: ['testing', 'nodejs']
role: 'Sole developer'
stack: ['Node.js', 'PostgreSQL']
year: 2026
featured: false
repo: https://github.com/you/thing   # optional
draft: false
---

Markdown body renders as the full writeup.
```

### Field reference

| Field      | Type       | Required | Notes                                              |
| ---------- | ---------- | -------- | -------------------------------------------------- |
| `title`    | string     | yes      |                                                    |
| `summary`  | string     | yes      | Card text, meta description, RSS description       |
| `tags`     | string[]   | no       | Each tag auto-generates `/projects/tags/<tag>`     |
| `role`     | string     | yes      | Your role, shown in the facts list                 |
| `stack`    | string[]   | no       | Shown on the card and detail page                  |
| `year`     | number     | yes      | Sorts the grid; drives RSS `pubDate`               |
| `featured` | boolean    | no       | Homepage shows the 3 newest featured projects      |
| `repo`     | URL        | no       | Validated as a real URL at build time              |
| `cover`    | image path | no       | Relative to the markdown file; optimised by Astro  |
| `coverAlt` | string     | if cover | **Required** whenever `cover` is set               |
| `draft`    | boolean    | no       | Visible in `pnpm dev`, stripped from prod builds   |

The schema is enforced by zod — a typo or missing required field fails the build
with a message pointing at the file, rather than shipping a broken page.

**Covers.** Put the image next to the markdown file and reference it relatively:

```yaml
cover: ./screenshot.png
coverAlt: 'The dashlet showing six hosts in a warning state.'
```

Astro processes it at build time and writes intrinsic `width`/`height` onto the
tag, which is what keeps layout shift at zero. `coverAlt` is required by the
schema when a cover is present — this is deliberate, and it's an accessibility
guard, not a nag.

**Drafts.** `draft: true` renders locally but never reaches production. All
filtering lives in `src/lib/projects.ts`; always query through `getProjects()`
rather than calling `getCollection('projects')` directly, or a draft will leak.

---

## Reskinning via tokens.css

**The rule:** `src/styles/tokens.css` is the only file containing literal colors,
font stacks, or px font-sizes. Every component references `var(--…)`. `pnpm run
lint:tokens` fails the build if that erodes.

### How theming works

Every themed value is declared once with the CSS `light-dark()` function:

```css
--color-bg: light-dark(var(--ink-25), var(--ink-950));
```

`light-dark()` resolves against the element's used `color-scheme`, so switching
the entire theme is **one declaration**, not a duplicated palette:

| State                     | Result                                     |
| ------------------------- | ------------------------------------------ |
| default                   | dark                                       |
| OS prefers light          | light (unless `[data-theme="dark"]` is set) |
| `[data-theme="light"]`    | light                                      |
| `[data-theme="dark"]`     | dark                                       |

There is no second palette block to keep in sync.

### Changing the look

The palette is two layers:

- **Layer 1 — primitives.** Raw ramps (`--ink-*`, `--cyan-*`, `--magenta-*`).
  Components never touch these.
- **Layer 2 — semantic.** `--color-bg`, `--color-text`, `--color-accent`, etc.
  This is the only vocabulary components use.

Most reskins are a Layer 1 edit:

| Want to change | Edit |
| --- | --- |
| The signal colour (drives links, focus, glow, brackets) | the six `--cyan-*` values |
| The rare second accent (drafts, 404, blockquotes) | the `--magenta-*` values |
| Ground/panel darkness | the `--ink-*` ramp |
| Sharpness | `--radius-*` — currently `0px`; set `4px` to soften everything |
| Type | `--font-display` (headings/labels), `--font-sans` (prose), `--text-*` |

**Turning off the CRT layer.** The atmosphere is three tokens. Set
`--scanline-opacity` to `0` to kill the scanlines, `--color-grid` to
`transparent` for the phosphor grid, and `--glow-strength` /
`--glow-strength-soft` to `0%` to remove all bloom. The layout is unchanged —
those effects are purely additive.

**The katakana.** Small decorative Japanese labels appear next to a few
eyebrows (`<span class="jp" lang="ja" aria-hidden="true">`). Every instance is
`aria-hidden`, so screen readers never announce it. To remove: delete the `.jp`
rule in `global.css` and grep out the spans.

### Adding a third theme

Append to the bottom of `tokens.css`. No component changes:

```css
:root[data-theme='lcars'] {
  color-scheme: dark;
  --color-bg: #000000;
  --color-accent: #ff9900;
  --font-sans: 'Antonio', var(--font-fallback-sans);
}
```

Set it with `<html data-theme="lcars">`. To add a user-facing toggle later,
write `data-theme` onto `document.documentElement` and persist to
`localStorage`; put the read in a small blocking inline script in
`BaseLayout.astro`'s `<head>` so there's no flash on load.

### Contrast

Both shipped themes pass WCAG AA (most pairs AAA) for body text, muted text,
links, button labels, and the focus ring.

If you change `--cyan-*` or the `--ink-*` ramp, re-check these pairs — they are
the ones that actually constrain the palette:

- accent-as-text on `--color-bg`
- `--color-accent-contrast` on an accent-filled button
- **hover direction**: `--color-accent-hover` must have *more* contrast than
  `--color-accent` in both themes. That means going lighter in dark mode and
  darker in light mode — which is why light uses `--cyan-800` rather than a
  lighter step. Getting this backwards is easy and silently fails AA on hover.

### The one exception

Syntax-highlighted code blocks. Shiki emits per-token colors as generated
output, so those hexes come from the theme names in `astro.config.mjs`
(`github-light-default` / `github-dark-default`), not from `tokens.css`. It runs
with `defaultColor: false`, so each token carries both light and dark values and
`global.css` picks the active one. Change the two theme names to restyle code
blocks, or set `syntaxHighlight: false` to drop highlighting entirely and style
`pre`/`code` from tokens.

---

## The résumé

`src/data/resume.ts` is the single source of truth. `/resume` renders directly
from it — never hard-code résumé content into the page.

### Regenerating the PDF

`public/resume.pdf` is currently a **placeholder**. To replace it:

1. Fill in `src/data/resume.ts`.
2. `pnpm dev`, then open <http://localhost:4321/resume>.
3. Print → Save as PDF. Print styles already strip the header, footer, and
   download button, and force the light palette.
4. Save over `public/resume.pdf`.

---

## Tag filtering & progressive enhancement

The filter works with JavaScript disabled. Each tag is a real link to a
statically generated page (`/projects/tags/php`), and **every** variant renders
the full card set with non-matching cards carrying the `hidden` attribute — which
browsers honour without JS.

With JS enabled, a 1.1 KB inlined script intercepts chip clicks, flips `hidden`
in place, and `pushState`s the same URL the link would have navigated to. Same
URLs, no round trip, back/forward preserved.

Verified: `/projects/tags/php` ships 3 cards, 1 visible, correct `aria-current`,
and a `role="status"` line that announces the result count to screen readers.

---

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with
`withastro/action` and publishes via `actions/deploy-pages`.

### Repo settings you must change

**This is the one manual step — the workflow fails without it.**

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
   (Not "Deploy from a branch" — that's the default and it will not work.)

That's it. No `gh-pages` branch, no `.nojekyll` file (Astro's output needs no
Jekyll processing, and `withastro/action` handles the artifact).

You can also trigger a deploy manually from the **Actions** tab —
the workflow includes `workflow_dispatch`.

### Notes

- `site` in `astro.config.mjs` must match the deployed origin; it's what makes
  canonical URLs, OG tags, RSS, and the sitemap absolute.
- No `base` path is set, because `<user>.github.io` serves from the root. If you
  ever move this to a project repo, add `base: '/repo-name'` and Astro rewrites
  every internal link and asset URL.
- A custom domain? Add `public/CNAME` containing the domain, and update `site`.

---

## Before this goes public

Search the tree for `TODO` — every placeholder is marked. The main ones:

- `src/data/site.ts` — GitHub / LinkedIn / email URLs are placeholders.
- `src/data/resume.ts` — entirely placeholder structure.
- `src/content/projects/*.md` — three scaffolds with section prompts. Nothing
  about the projects was invented; the prompts describe what to write.
- `src/pages/index.astro` — hero headline and bio are drafts, in comments.
- `public/resume.pdf` — placeholder PDF.
- `public/og-default.png` — placeholder social card.
- `public/favicon.svg` — placeholder "RR" monogram. Its colors are inlined
  because a favicon is a standalone document and can't read `tokens.css`; update
  them if you reskin.

```sh
grep -rn "TODO" src/ public/
```

---

## RSS

`/rss.xml` exists and currently carries projects. `BaseLayout` emits the
autodiscovery `<link>` on every page, so subscribers won't need a new URL when a
blog is added. To add one: define a `blog` collection in `content.config.ts`,
then concat the two item arrays in `src/pages/rss.xml.ts` sorted by date.

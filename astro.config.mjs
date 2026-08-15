// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Root-served GitHub Pages user site (https://ryan-reisdorf.github.io).
// No `base` path is needed for a `<user>.github.io` repo. If this ever moves
// to a project repo (github.com/<user>/portfolio), add `base: '/portfolio'`
// here and Astro will rewrite every internal link and asset URL for you.
export default defineConfig({
  site: 'https://ryan-reisdorf.github.io',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  integrations: [
    // Emits /sitemap-index.xml, referenced from public/robots.txt.
    // Tag pages are excluded: they're navigation over the same set of
    // projects, not distinct content worth indexing separately.
    sitemap({
      filter: (page) => !page.includes('/projects/tags/'),
    }),
  ],
  markdown: {
    // Dual-theme Shiki with `defaultColor: false` emits per-token
    // `--shiki-light` / `--shiki-dark` custom properties instead of baked-in
    // inline colors, so code blocks follow the active theme. global.css picks
    // which one applies. See README "Reskinning" for the one caveat here.
    shikiConfig: {
      themes: { light: 'github-light-default', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: true,
    },
  },
});

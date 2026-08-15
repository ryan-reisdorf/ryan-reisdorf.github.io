## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## This project

- Every design value lives in `src/styles/tokens.css`. Components use `var(--…)`
  only — no literal colors, px font-sizes, or font stacks. `pnpm run lint:tokens`
  enforces this; run `pnpm run verify` before pushing.
- Query projects through `src/lib/projects.ts`, never `getCollection('projects')`
  directly — draft filtering lives there.
- TypeScript is pinned to 6.x; `astro check` doesn't work with TS 7 yet.

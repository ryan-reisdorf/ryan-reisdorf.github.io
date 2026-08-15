import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Import zod directly — the `z` re-export from 'astro:content' is deprecated
// and slated for removal. Astro 7 is on zod 4.
import { z } from 'zod';

/**
 * Projects collection.
 *
 * Entry IDs come from the filename, so `src/content/projects/foo-bar.md`
 * is served at `/projects/foo-bar`.
 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  // `image()` is only available in the function form of `schema`. It gives
  // covers build-time optimisation plus intrinsic width/height, which is what
  // keeps cumulative layout shift at zero.
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** One or two sentences. Used on cards, meta description, and RSS. */
      summary: z.string(),
      tags: z.array(z.string()).default([]),
      /** Your role on the project, e.g. "Sole developer". */
      role: z.string(),
      stack: z.array(z.string()).default([]),
      year: z.number().int().min(1990).max(2100),
      /** Featured projects appear on the homepage (top 3 by year). */
      featured: z.boolean().default(false),
      repo: z.url().optional(),
      cover: image().optional(),
      /** Alt text is required whenever a cover is set — enforced below. */
      coverAlt: z.string().optional(),
      /** Drafts render in `astro dev` but are stripped from production builds. */
      draft: z.boolean().default(false),
    })
    .refine((data) => !data.cover || (data.coverAlt && data.coverAlt.length > 0), {
      message: 'coverAlt is required when a cover image is set (accessibility).',
      path: ['coverAlt'],
    }),
});

export const collections = { projects };

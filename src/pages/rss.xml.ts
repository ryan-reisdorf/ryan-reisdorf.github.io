import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getProjects } from '../lib/projects';
import { site } from '../data/site';

/**
 * RSS feed. There's no blog yet, so this carries projects.
 *
 * When you add a blog:
 *   1. Add a `blog` collection in src/content.config.ts (same shape, plus a
 *      real `pubDate`).
 *   2. Import getBlogPosts here and concat the two item arrays, sorting by
 *      pubDate descending.
 * BaseLayout already emits the <link rel="alternate"> autodiscovery tag on
 * every page, so subscribers won't need to be told the URL changed.
 */
export async function GET(context: APIContext) {
  const projects = await getProjects();

  return rss({
    title: `${site.title} — Projects`,
    description: site.description,
    site: context.site ?? site.url,
    // Projects carry a year, not a full date. Jan 1 of that year keeps items
    // ordered correctly without inventing a publication day.
    items: projects.map((project) => ({
      title: project.data.title,
      description: project.data.summary,
      link: `/projects/${project.id}`,
      pubDate: new Date(Date.UTC(project.data.year, 0, 1)),
      categories: project.data.tags,
    })),
    customData: `<language>${site.locale}</language>`,
  });
}

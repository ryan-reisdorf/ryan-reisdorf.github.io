import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

/**
 * Every project, newest first.
 *
 * Drafts are visible in `astro dev` so you can preview them, and stripped from
 * production builds. This is the ONLY place that filtering happens — always
 * go through this helper rather than calling getCollection('projects')
 * directly, or a draft will leak onto a page.
 */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', ({ data }) =>
    import.meta.env.PROD ? data.draft !== true : true,
  );

  return projects.sort((a, b) => {
    if (b.data.year !== a.data.year) return b.data.year - a.data.year;
    return a.data.title.localeCompare(b.data.title);
  });
}

/** Featured projects for the homepage. */
export async function getFeaturedProjects(limit = 3): Promise<Project[]> {
  const projects = await getProjects();
  const featured = projects.filter((p) => p.data.featured);
  // Fall back to the newest projects so the homepage is never empty if
  // nothing has been flagged featured yet.
  return (featured.length > 0 ? featured : projects).slice(0, limit);
}

/** Every tag in use, with counts, sorted by frequency then alphabetically. */
export async function getTags(): Promise<Array<{ tag: string; count: number }>> {
  const projects = await getProjects();
  const counts = new Map<string, number>();

  for (const project of projects) {
    for (const tag of project.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** URL-safe form of a tag, used for /projects/tags/<slug>. */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

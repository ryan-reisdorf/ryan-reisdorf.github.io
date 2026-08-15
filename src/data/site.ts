/**
 * Site-wide constants. Single source of truth for anything that appears in
 * more than one place (meta tags, header, footer, RSS feed, links page).
 */

export interface SiteLink {
  label: string;
  href: string;
  /** Shown under the label on the /links page. */
  description?: string;
  /** Surface this one in the site header / footer. */
  primary?: boolean;
}

export const site = {
  /** Must match `site` in astro.config.mjs. */
  url: 'https://ryan-reisdorf.github.io',
  title: 'Ryan Reisdorf',
  /** Used as the default <title> suffix and in the RSS channel. */
  tagline: 'QA Engineer — test automation, tooling, and homelab infrastructure',
  description:
    'QA engineer at Nagios building test automation and custom dashlets. ' +
    'Homelab operator and cybersecurity graduate student.',
  author: 'Ryan Reisdorf',
  /** BCP 47 language tag, used on <html lang> and in the RSS feed. */
  locale: 'en-US',
  /** Default Open Graph image, served from /public. 1200×630. */
  ogImage: '/og-default.png',
} as const;

/**
 * Header/footer navigation. Order here is the order rendered.
 */
export const navigation: SiteLink[] = [
  { label: 'Projects', href: '/projects' },
  { label: 'Résumé', href: '/resume' },
  { label: 'Links', href: '/links' },
];

/**
 * The /links hub. `primary: true` also renders in the footer.
 *
 * TODO: replace every placeholder href below with your real profile URLs,
 * and delete any row you don't want public.
 */
export const links: SiteLink[] = [
  {
    label: 'GitHub',
    href: 'https://github.com/ryan-reisdorf', // TODO: verify username
    description: 'Source for most of what is listed under Projects.',
    primary: true,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/TODO-your-handle', // TODO
    description: 'Work history and the occasional post.',
    primary: true,
  },
  {
    label: 'Email',
    href: 'mailto:TODO@example.com', // TODO: the address you want public
    description: 'Best way to reach me.',
    primary: true,
  },
  {
    label: 'Résumé (PDF)',
    href: '/resume.pdf',
    description: 'Same content as the résumé page, printable.',
  },
];

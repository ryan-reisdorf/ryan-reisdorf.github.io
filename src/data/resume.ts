/**
 * resume.ts — the ONE source of truth for résumé content.
 *
 * /resume renders this file directly. The PDF in /public/resume.pdf should be
 * exported from that rendered page (see README → "Regenerating the PDF") so
 * the two can never drift apart.
 *
 * Everything marked TODO is a placeholder. Nothing here was invented on your
 * behalf beyond the job title / employer / focus areas you supplied.
 */

export interface ResumeRole {
  title: string;
  organization: string;
  location: string;
  /** Display strings, not dates — e.g. "Mar 2022". */
  start: string;
  /** Use 'Present' for a current role. */
  end: string;
  summary?: string;
  highlights: string[];
}

export interface ResumeEducation {
  credential: string;
  institution: string;
  location?: string;
  start?: string;
  end: string;
  notes?: string[];
}

export interface ResumeSkillGroup {
  label: string;
  items: string[];
}

export interface ResumeCertification {
  name: string;
  issuer: string;
  /** Or 'In progress'. */
  earned: string;
}

export interface Resume {
  name: string;
  headline: string;
  location: string;
  summary: string;
  experience: ResumeRole[];
  education: ResumeEducation[];
  skills: ResumeSkillGroup[];
  certifications: ResumeCertification[];
  /** ISO date, shown as "last updated" on the page. */
  updated: string;
}

export const resume: Resume = {
  name: 'Ryan Reisdorf',
  headline: 'QA Engineer — Test Automation & Internal Tooling',
  location: 'TODO: City, State',

  summary:
    'TODO: two or three sentences in your own voice. Worth covering: that you ' +
    'work QA at Nagios across both test automation and custom dashlet ' +
    'development, that you run a homelab you actually maintain, and that ' +
    "you're finishing a cybersecurity master's. Keep it concrete — what you " +
    'build and what breaks less because of it.',

  experience: [
    {
      title: 'QA Engineer',
      organization: 'Nagios Enterprises',
      location: 'TODO: City, State (or Remote)',
      start: 'TODO: Mon YYYY',
      end: 'Present',
      summary:
        'TODO: one line framing the role — which products you cover and where ' +
        'automation sits relative to manual QA on your team.',
      highlights: [
        'TODO: the TestCafe/Node.js harness — what it covers, roughly how many ' +
          'suites/cases, and what it replaced.',
        'TODO: custom dashlet development for Nagios XI (PHP/JS) — who the ' +
          'dashlets were for and what they surface.',
        'TODO: a regression-escape or release-cycle number if you have one. ' +
          'Even "cut manual release verification from N days to M" lands well.',
        'TODO: anything CI-related — where the suite runs, on what trigger.',
        'TODO: cross-functional work — bug triage, working with support/dev, ' +
          'release sign-off.',
      ],
    },
    // TODO: add earlier roles / internships here in the same shape, newest
    // first. Delete this comment once you have.
  ],

  education: [
    {
      credential: "Master of Science, Cybersecurity", // TODO: exact degree name
      institution: 'TODO: University',
      location: 'TODO: City, State (or Online)',
      start: 'TODO: YYYY',
      end: 'TODO: Expected Mon YYYY',
      notes: [
        'TODO: coursework worth naming — e.g. network defense, digital ' +
          'forensics, applied cryptography.',
        'TODO: capstone or thesis topic, if there is one.',
      ],
    },
    {
      credential: 'TODO: Bachelor of Science, Field',
      institution: 'TODO: University',
      location: 'TODO: City, State',
      end: 'TODO: YYYY',
    },
  ],

  skills: [
    {
      label: 'Test & Automation',
      items: [
        'TestCafe',
        'Node.js',
        'JavaScript',
        'TODO: add — e.g. Playwright, Selenium, Jest, pytest',
        'Regression & release testing',
        'Bug triage',
      ],
    },
    {
      label: 'Languages',
      items: ['JavaScript', 'PHP', 'TODO: Python?', 'Bash', 'SQL', 'TODO: others'],
    },
    {
      label: 'Platforms & Infrastructure',
      items: [
        'Nagios XI',
        'Nagios Log Server',
        'Docker',
        'Linux (TODO: which distros)',
        'Reverse proxies (TODO: Traefik / Caddy / nginx)',
        'TODO: CI system you use',
      ],
    },
    {
      label: 'Security',
      items: [
        'TODO: fill from coursework and homelab — e.g. log analysis, network ' +
          'monitoring, hardening, vulnerability scanning',
      ],
    },
  ],

  certifications: [
    // TODO: add real certs, or delete this array and the section renders as
    // nothing. Example shape:
    // { name: 'CompTIA Security+', issuer: 'CompTIA', earned: 'Mon YYYY' },
  ],

  updated: 'TODO: YYYY-MM-DD',
};

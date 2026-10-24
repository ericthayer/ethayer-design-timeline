// Document fixtures for the validator (spec 004 content-json, FR-316): valid eras, site, résumé,
// and order documents, plus one breaking change per document rule.
import type { JsonObject } from './projects.ts';

export const baseEras = (): JsonObject[] => [
  {
    id: 'cobank',
    label: 'CoBank',
    period: { start: '2023-12', end: 'present' },
    engagement: 'full-time',
  },
  {
    id: 'independent',
    label: 'Independent',
    period: { start: '2015-07', end: '2021-12' },
    engagement: 'freelance',
  },
];

export const baseSite = (): JsonObject => ({
  name: 'Demo Person',
  role: 'Engineer',
  location: 'Denver, CO',
  summary: 'Demo summary.',
  span: { start: '2003-01', end: 'present' },
  links: [
    { label: 'Résumé', href: '/resume' },
    { label: 'GitHub', href: 'https://github.com/demo/' },
    { label: 'Email', href: 'mailto:demo@example.com' },
  ],
  education: [{ degree: 'B.S.', school: 'Demo College', year: '2005' }],
});

export const baseResume = (): JsonObject => ({
  headline: 'Design systems',
  summary: 'Demo résumé.',
  experience: [
    {
      role: 'Engineer',
      company: 'Demo Co',
      location: 'Remote',
      period: { start: '2020-01', end: 'present' },
      summary: 'Did things.',
      highlights: ['Shipped a thing.'],
      href: 'https://demo.example/',
    },
  ],
  skills: ['Design'],
  proficiencies: { development: ['TypeScript'], software: ['Figma'] },
  projects: [{ title: 'Demo', detail: 'UI', year: '2021' }],
});

export interface DocumentFixture {
  readonly eras?: JsonObject[];
  readonly site?: JsonObject;
  readonly resume?: JsonObject;
  readonly order?: JsonObject;
  readonly path: string;
}

export const ERA_FIXTURES = {
  unknown: { eras: [{ ...baseEras()[0], id: 'nasa' }], path: '/0/id' },
  duplicate: { eras: [...baseEras(), { ...baseEras()[1] }], path: '/2/id' },
  oldestFirst: { eras: [...baseEras()].reverse(), path: '/1/period/start' },
} satisfies Record<string, DocumentFixture>;

export const PERIOD_FIXTURE = {
  site: { ...baseSite(), span: { start: '2003-00', end: 'present' } },
  path: '/span/start',
} satisfies DocumentFixture;

export const URL_FIXTURE = {
  site: { ...baseSite(), links: [{ label: 'Blog', href: 'http://demo.example/' }] },
  path: '/links/0/href',
} satisfies DocumentFixture;

export const ORDER_KEY_FIXTURE = {
  order: { cobank: ['demo'], nasa: [] },
  path: '/nasa',
} satisfies DocumentFixture;

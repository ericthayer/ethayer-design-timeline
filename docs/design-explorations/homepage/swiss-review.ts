import '../../../src/styles/layers.css';
import '../../../src/styles/fonts.css';
import '../../../src/styles/tokens.css';
import '../../../src/styles/base.css';
import {
  define as defineCard,
  ProjectCard,
} from '../../../src/components/project-card/project-card.ts';
import {
  define as defineArtwork,
  renderArtwork,
} from '../../../src/components/swiss-artwork/swiss-artwork.ts';
import { PROJECTS } from '../../../src/content/projects/index.ts';
import { el } from '../../../src/core/dom.ts';
import { getScheduler } from '../../../src/core/media-scheduler.ts';
import data from './mock-data.json';
import './swiss-review.css';
import './swiss-review-responsive.css';

defineArtwork();
defineCard();
getScheduler().setGate('motion', true);

const main = document.querySelector('main')!;
const selected = ['agentic-engineering-loop', 'drift-detection', 'hs-brand-systems'];
const stats = [
  ['40 %', 'faster feature delivery'],
  ['33 %', 'fewer UI drift fixes before release'],
  ['16', 'web and VR products on one system'],
];
const categories = [
  [
    'design-systems',
    'Design systems',
    'Tokens, components and docs serving 120+ designers and developers.',
  ],
  [
    'agentic-engineering',
    'Agentic engineering',
    'Agents and CI checks that turn Figma specs into consistent, shipped UI.',
  ],
  [
    'front-end-platforms',
    'Front-end platforms',
    'Responsive frameworks and platforms, 240+ sites built or rebuilt.',
  ],
  [
    'product-design',
    'Product and UX design',
    'Sprints, prototypes and web design, from idea to tested flow.',
  ],
  ['motion-media', 'Motion and media', 'Training media and motion for learning products.'],
];

function card(slug: string, size: 'sm' | 'tall'): HTMLElement {
  const project = PROJECTS.find((p) => p.slug === slug)!;
  const component = new ProjectCard();
  const media = project.media.kind === 'iframe' ? project.media.poster : project.media;
  component.project = { ...project, size, media };
  component.eager = true;
  const frame = el('div', { class: `review-card review-card--${size}` }, [component]);
  // Repeated projects on this overview need unique accessible heading IDs.
  queueMicrotask(() => {
    const heading = component.querySelector('h3');
    if (heading) {
      heading.id += `-${size}`;
      component.querySelector('article')?.setAttribute('aria-labelledby', heading.id);
    }
  });
  return frame;
}

function art(motif: Parameters<typeof renderArtwork>[0], seed: number): HTMLElement {
  return el('div', { class: 'review-art', 'aria-hidden': 'true' }, [renderArtwork(motif, seed)]);
}

const hero = el('section', { class: 'review-hero', 'data-theme': 'indigo-vermilion' }, [
  el('div', { class: 'review-hero__copy' }, [
    el('p', { class: 'review-eyebrow' }, ['Eric Thayer', el('span', {}, ['Denver, CO'])]),
    el('h1', {}, ['I build design systems,', el('em', {}, ['and the agents that ship them.'])]),
    el('div', { class: 'review-hero__foot' }, [
      el('p', {}, [
        '23 years in UI. Systems used by 120+ designers and developers. Six roles, from multimedia specialist to systems lead.',
      ]),
      el('a', { href: '#selected', class: 'review-cta' }, [
        'See selected work',
        el('span', { 'aria-hidden': 'true' }, ['↓']),
      ]),
    ]),
  ]),
  art('tri-mosaic', 27),
]);
main.append(hero);

const selection = el('section', { id: 'selected', class: 'review-selection' }, [
  el('header', { class: 'review-section-head' }, [
    el('h2', {}, ['Selected work']),
    el('a', { href: '/resume' }, ['Résumé ↗']),
  ]),
]);
selection.append(
  el(
    'div',
    { class: 'review-selected' },
    selected.map((slug, i) => {
      const project = PROJECTS.find((p) => p.slug === slug)!;
      return el('div', {}, [
        card(slug, 'tall'),
        el('div', { class: 'review-stat' }, [
          el('strong', {}, [stats[i]![0]!]),
          el('p', {}, [stats[i]![1]!]),
          el('small', {}, [`${project.client} · ${project.role}`]),
        ]),
      ]);
    }),
  ),
);
main.append(selection);

function banner(
  id: string,
  label: string,
  title: string,
  index: string,
  summary: string,
  motif: Parameters<typeof renderArtwork>[0],
  theme: string,
): HTMLElement {
  return el('section', { id, class: `review-banner review-banner--${id}`, 'data-theme': theme }, [
    el('div', { class: 'review-banner__copy' }, [
      el('p', { class: 'review-eyebrow' }, [label, el('span', {}, [index])]),
      el('h2', {}, [title]),
      el('p', { class: 'review-banner__summary' }, [summary]),
    ]),
    art(motif, 48),
  ]);
}
main.append(
  banner(
    'capabilities',
    'Capabilities',
    'What I do',
    '05 / 21',
    'Design systems, agentic engineering and front-end platforms, with the best example of each.',
    'pinwheels',
    'mustard',
  ),
);
const groups = el('div', { class: 'review-categories' });
for (const [id, label, summary] of categories) {
  const rows = data.rows.filter((row) => row.cat === id);
  groups.append(
    el('section', { class: 'review-category' }, [
      el('div', {}, [
        el('h2', {}, [label!]),
        el('p', {}, [summary!]),
        el('a', { href: `/projects#category-${id}` }, [`See all ${rows.length} ↗`]),
      ]),
      el(
        'div',
        { class: 'review-category__cards' },
        rows.slice(0, 3).map((r) => card(r.slug, 'sm')),
      ),
    ]),
  );
}
main.append(groups);
main.append(
  banner(
    'career',
    '2010–Now',
    'Career',
    '06 / 10',
    'Six roles since 2010. From multimedia specialist to systems lead: what I did at each role and what came of it.',
    'horizon-lines',
    'paper-ink',
  ),
);
const eras = [
  [
    'cobank',
    '2023–Now',
    'CoBank',
    'Senior UX Engineer / Systems Lead',
    'Agent toolkit and design system for 120+ builders; features ship 40 % faster.',
  ],
  [
    'threecolts',
    '2023–2024',
    'Threecolts / Onsite Support',
    'Lead UI/UX Designer & Front-End Developer',
    'Led UI for Amazon-seller tools; 200+ legacy sites rebuilt mobile-first.',
  ],
  [
    'health-scholars',
    '2017–2023',
    'Health Scholars',
    'UI/UX Designer & Front-End Developer',
    'One brand and UI system across 16 web and VR products.',
  ],
  [
    'independent',
    '2015–2021',
    'Independent',
    'UI/UX & front-end consultant',
    'Frameworks and design systems for startups, a museum and retailers.',
  ],
  [
    'navigators',
    '2011–2015',
    'The Navigators',
    'UI Designer & Front-End Developer',
    '40+ responsive platforms with better donation flows.',
  ],
  [
    'dli',
    '2010–2013',
    'Defense Language Institute',
    'Multimedia Specialist & Front-End Designer',
    'Mobile learning UI and 100+ training media for language training.',
  ],
];
const roles = el('div', { class: 'review-roles' });
for (const [id, years, client, role, outcome] of eras) {
  const count = data.rows.filter((r) => r.era === id).length;
  roles.append(
    el('section', { class: 'review-role' }, [
      el('p', {}, [years!]),
      el('div', {}, [el('h3', {}, [client!]), el('small', {}, [role!])]),
      el('p', {}, [outcome!]),
      el('a', { href: `/#era-${id}` }, [`${count} projects ↗`]),
    ]),
  );
}
main.append(roles);

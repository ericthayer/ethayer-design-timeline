import { ProjectCard } from '../project-card/project-card.ts';
import { renderArtwork } from '../swiss-artwork/swiss-artwork.ts';
import type { Project } from '../../content/types.ts';
import { el } from '../../core/dom.ts';
import './site-home.css';
import './site-home-responsive.css';

/** The approved Swiss overview, rendered from the public content set (FR-235). */
export function renderHome(projects: readonly Project[]): HTMLElement {
  const main = el('div', { class: 'site-home' });
  let cardIndex = 0;
  const selected = ['agentic-engineering-loop', 'drift-detection', 'hs-brand-systems'];
  const stats = [
    ['40 %', 'faster feature delivery'],
    ['33 %', 'fewer UI drift fixes before release'],
    ['16', 'web and VR products on one system'],
  ] as const;
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
  ] as const;

  function card(project: Project, size: 'sm' | 'tall'): HTMLElement {
    const instance = ++cardIndex;
    const component = new ProjectCard();
    const media = project.media.kind === 'iframe' ? project.media.poster : project.media;
    component.project = { ...project, size, media };
    component.eager = size === 'tall';
    const frame = el('div', { class: `home-card home-card--${size}` }, [component]);
    // Repeated projects on this overview need unique accessible heading IDs.
    queueMicrotask(() => {
      const heading = component.querySelector('h3');
      if (heading) {
        heading.id += `-home-${instance}`;
        component.querySelector('article')?.setAttribute('aria-labelledby', heading.id);
      }
    });
    return frame;
  }

  function art(motif: Parameters<typeof renderArtwork>[0], seed: number): HTMLElement {
    return el('div', { class: 'home-art', 'aria-hidden': 'true' }, [renderArtwork(motif, seed)]);
  }

  const hero = el('section', { class: 'home-hero', 'data-theme': 'indigo-vermilion' }, [
    el('div', { class: 'home-hero__copy' }, [
      el('p', { class: 'home-eyebrow' }, ['Eric Thayer', el('span', {}, ['Denver, CO'])]),
      el('h1', {}, ['I build design systems,', el('em', {}, ['and the agents that ship them.'])]),
      el('div', { class: 'home-hero__foot' }, [
        el('p', {}, [
          '23 years in UI. Systems used by 120+ designers and developers. Six roles, from multimedia specialist to systems lead.',
        ]),
        el('a', { href: '#selected', class: 'home-cta' }, [
          'See selected work',
          el('span', { 'aria-hidden': 'true' }, ['↓']),
        ]),
      ]),
    ]),
    art('tri-mosaic', 27),
  ]);
  main.append(hero);

  const selection = el('section', { id: 'selected', class: 'home-selection', tabindex: '-1' }, [
    el('header', { class: 'home-section-head' }, [
      el('h2', {}, ['Selected work']),
      el('a', { href: '/resume' }, ['Résumé ↗']),
    ]),
  ]);
  selection.append(
    el(
      'div',
      { class: 'home-selected' },
      selected.flatMap((slug, i) => {
        const project = projects.find((p) => p.slug === slug);
        const stat = stats[i];
        if (!project || !stat) return [];
        return el('div', {}, [
          card(project, 'tall'),
          el('div', { class: 'home-stat' }, [
            el('strong', {}, [stat[0]]),
            el('p', {}, [stat[1]]),
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
    return el('section', { id, class: `home-banner home-banner--${id}`, 'data-theme': theme }, [
      el('div', { class: 'home-banner__copy' }, [
        el('p', { class: 'home-eyebrow' }, [label, el('span', {}, [index])]),
        el('h2', {}, [title]),
        el('p', { class: 'home-banner__summary' }, [summary]),
      ]),
      art(motif, 48),
    ]);
  }
  main.append(
    banner(
      'capabilities',
      'Capabilities',
      'What I do',
      `05 / ${projects.length}`,
      'Design systems, agentic engineering and front-end platforms, with the best example of each.',
      'pinwheels',
      'mustard',
    ),
  );
  const groups = el('div', { class: 'home-categories' });
  for (const [id, label, summary] of categories) {
    const rows = projects.filter((project) => project.categories[0] === id);
    groups.append(
      el('section', { class: 'home-category' }, [
        el('div', {}, [
          el('h2', {}, [label]),
          el('p', {}, [summary]),
          el('a', { href: `/projects#category-${id}` }, [`See all ${rows.length} ↗`]),
        ]),
        el(
          'div',
          { class: 'home-category__cards' },
          rows.slice(0, 3).map((r) => card(r, 'sm')),
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
  ] as const;
  const roles = el('div', { class: 'home-roles' });
  for (const [id, years, client, role, outcome] of eras) {
    const count = projects.filter((project) => project.era === id).length;
    roles.append(
      el('section', { class: 'home-role' }, [
        el('p', {}, [years]),
        el('div', {}, [el('h3', {}, [client]), el('small', {}, [role])]),
        el('p', {}, [outcome]),
        el('a', { href: `/experience#era-${id}` }, [`${count} projects ↗`]),
      ]),
    );
  }
  main.append(roles);

  return main;
}

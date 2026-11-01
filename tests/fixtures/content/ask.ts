// Ask fixtures (spec 005, T400): a valid ask.json and about.json, plus the projects they may link to.
import type { AskProjects } from '../../../src/content/validate/ask.ts';
import type { JsonObject } from './projects.ts';

export const ASK_PROJECTS: AskProjects = {
  slugs: new Set(['dmns', 'hs-vue-library', 'workbench']),
  drafts: new Set(['workbench']),
};

export const baseAsk = (): JsonObject => ({
  chips: [
    {
      id: 'design-systems',
      label: 'How does Eric run a design system?',
      topic: 'process',
      answer: ['He starts from tokens.', 'Then components.'],
      related: ['hs-vue-library'],
      followups: ['accessibility'],
    },
    {
      id: 'accessibility',
      label: 'How does he approach accessibility?',
      topic: 'work',
      answer: ['Semantic HTML first.'],
      related: ['dmns'],
      followups: [],
    },
  ],
});

export const baseAbout = (): JsonObject => ({
  sections: [
    { id: 'how-i-work', topic: 'process', title: 'How I work', text: 'Design and code together.' },
    { id: 'outside-work', topic: 'personal', title: 'Outside work', text: 'Cycling in Denver.' },
  ],
});

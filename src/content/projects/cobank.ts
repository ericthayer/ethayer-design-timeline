import type { Project } from '../types.ts';

const period = { start: '2023-12', end: 'present' } as const;
const client = 'CoBank';
const role = 'Senior UX Engineer / Systems Lead';

export const cobank = [
  {
    slug: 'agentic-engineering-loop',
    title: 'Agentic Engineering Loop',
    client,
    era: 'cobank',
    engagement: 'full-time',
    role,
    period,
    size: 'feature',
    treatment: 'swiss',
    layout: 'title-top',
    theme: 'ink-vermilion',
    motif: 'eclipse',
    media: { kind: 'artwork' },
    summary:
      'An MCP server and agent toolkit that turns Figma specs into token-wired React scaffolding, cutting feature development time by 40 %.',
    body: {
      context:
        'Developers spent about 10 hours per component or view translating Figma specs by hand and wiring tokens into boilerplate React.',
      contribution:
        'Designed and built an agentic engineering loop: a Model Context Protocol server plus an agent toolkit that reads design context, injects tokens, and scaffolds components against the design system.',
      outcome:
        'Average scaffolding and token wiring dropped from 10 hours to 6 per component or view across sprint tasks.',
    },
    tracklist: [
      { label: 'Feature dev time', value: '−40 %' },
      { label: 'MCP server' },
      { label: 'Agent toolkit' },
      { label: 'React · MUI' },
      { label: 'TypeScript' },
    ],
    metrics: [
      { value: '40 %', label: 'less feature development time', baseline: '10 h', result: '6 h' },
    ],
  },
  {
    slug: 'cobank-design-system',
    title: 'Multi-Framework Design System',
    client,
    era: 'cobank',
    engagement: 'full-time',
    role,
    period,
    size: 'feature',
    treatment: 'standard',
    layout: 'title-bottom',
    theme: 'paper-mocha',
    motif: 'petals',
    media: { kind: 'placeholder', variant: 'design' },
    summary:
      'Design system strategy and a React/MUI component architecture serving 120+ developers and designers across enterprise products.',
    body: {
      context:
        'Enterprise product teams were building on several frameworks with no shared component foundation.',
      contribution:
        'Direct the multi-framework design system strategy and build and maintain the React/MUI component architecture, with documentation in Storybook.',
      outcome: 'The architecture serves 120+ cross-functional developers and designers.',
    },
    tracklist: [
      { label: 'Consumers', value: '120+' },
      { label: 'React · MUI' },
      { label: 'Storybook' },
      { label: 'W3C design tokens' },
    ],
    metrics: [{ value: '120+', label: 'developers and designers served' }],
  },
  {
    slug: 'figma-token-pipeline',
    title: 'Figma → Token Pipeline',
    client,
    era: 'cobank',
    engagement: 'full-time',
    role,
    period,
    size: 'wide',
    treatment: 'standard',
    layout: 'title-top',
    theme: 'ink-cyan',
    motif: 'tone-dots',
    media: { kind: 'placeholder', variant: 'design' },
    summary:
      'A token pipeline that syncs Figma variables to JSON tokens, Material UI themes, and Storybook in one pass.',
    body: {
      context: 'Design decisions in Figma drifted from the values shipped in code.',
      contribution:
        'Built a pipeline that syncs Figma variables directly to JSON-based tokens, Material UI styles, and the Storybook component library.',
      outcome: 'One source of truth for color, type, and spacing from design file to production.',
    },
    tracklist: [
      { label: 'Figma variables' },
      { label: 'JSON tokens' },
      { label: 'MUI theme' },
      { label: 'Storybook' },
    ],
  },
  {
    slug: 'drift-detection',
    title: 'Spec & Drift Detection',
    client,
    era: 'cobank',
    engagement: 'full-time',
    role,
    period,
    size: 'tall',
    treatment: 'swiss',
    layout: 'title-bottom',
    theme: 'paper-graphite',
    motif: 'drift-bars',
    media: { kind: 'artwork' },
    summary:
      'An agentic spec and drift detection tool in CI/CD that catches UI inconsistencies before merge, cutting drift fixes by 33 %.',
    body: {
      context:
        'QA tickets tagged "UI inconsistency", "spec mismatch", or "outdated documentation" averaged 18 per release cycle.',
      contribution:
        'Engineered an automated agentic spec and drift detection tool that runs in CI/CD and flags discrepancies before pull requests merge.',
      outcome:
        'Drift tickets fell from 18 to 12 per release, with 6 caught upstream in pre-merge checks.',
    },
    tracklist: [
      { label: 'Drift fixes', value: '−33 %' },
      { label: 'CI/CD' },
      { label: 'Agentic linting' },
      { label: 'Spec checks' },
    ],
    metrics: [
      { value: '33 %', label: 'fewer drift-related release fixes', baseline: '18', result: '12' },
    ],
  },
  {
    slug: 'accessible-components',
    title: 'A11y Standards',
    client,
    era: 'cobank',
    engagement: 'full-time',
    role,
    period,
    size: 'sm',
    treatment: 'standard',
    layout: 'title-top',
    theme: 'paper-ink',
    motif: 'nested-squares',
    media: { kind: 'placeholder', variant: 'site' },
    summary:
      'Standardized component access and implementation guidelines, dropping performance and accessibility errors by 37 %.',
    body: {
      context:
        'Legacy feature views averaged 30 flagged issues in Lighthouse, axe-core, and Chromatic audits.',
      contribution:
        'Embedded pre-tested ARIA patterns and optimized asset pipelines into the core components, plus implementation guidelines.',
      outcome: 'Teams inherit compliant code by default. Flagged issues dropped from 30 to 19.',
    },
    tracklist: [
      { label: 'Audit errors', value: '−37 %' },
      { label: 'axe-core' },
      { label: 'Lighthouse' },
      { label: 'Chromatic' },
    ],
    metrics: [
      { value: '37 %', label: 'fewer performance and a11y errors', baseline: '30', result: '19' },
    ],
  },
] as const satisfies readonly Project[];

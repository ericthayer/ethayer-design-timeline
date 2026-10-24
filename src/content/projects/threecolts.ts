import type { Project } from '../types.ts';

const client = 'Onsite Support';
const role = 'Lead UI/UX Designer & Front-End Developer';

export const threecolts = [
  {
    slug: 'qr-landing',
    title: 'QR Landing Page',
    client,
    era: 'threecolts',
    engagement: 'contract',
    role,
    period: { start: '2023-06', end: '2023-12' },
    size: 'wide',
    treatment: 'standard',
    layout: 'title-top',
    theme: 'coral',
    motif: 'horizon-lines',
    media: {
      kind: 'iframe',
      src: 'https://qrlanding.netlify.app/',
      title: 'QR Landing Page live site',
      viewport: 'desktop',
      poster: { kind: 'image', src: 'qr-landing/cover', alt: 'Onsite Support QR landing page' },
    },
    summary:
      'A QR-driven landing page that routes Amazon sellers into onboarding and live support.',
    body: {
      context: 'Sellers scanning printed QR codes landed on pages built for desktop.',
      contribution:
        'Designed and built a responsive landing page tuned for the scan-to-support flow.',
      outcome: 'Shipped on Netlify and reused as a template for later campaign pages.',
    },
    tracklist: [{ label: 'HTML/CSS' }, { label: 'JavaScript' }, { label: 'Netlify' }],
    links: [
      { label: 'Live site', href: 'https://qrlanding.netlify.app/', kind: 'live' },
      { label: 'Repository', href: 'https://github.com/ericthayer/qr-landing', kind: 'repo' },
    ],
    draft: true,
  },
  {
    slug: 'onsite-figma-template',
    title: 'Figma Theme Template',
    client,
    era: 'threecolts',
    engagement: 'contract',
    role,
    period: { start: '2023-06', end: '2023-12' },
    size: 'sm',
    treatment: 'standard',
    layout: 'title-top',
    theme: 'paper-cobalt',
    motif: 'petals',
    media: {
      kind: 'image',
      src: 'onsite-figma-template/cover',
      alt: 'Onsite Support landing page design template in Figma',
    },
    summary: 'Modular Figma themes that guide Amazon sellers through onboarding.',
    body: {
      context: 'Each seller landing page was designed from scratch.',
      contribution:
        'Designed a modular Figma theme and landing page template with reusable sections.',
      outcome: 'New pages start from a shared, themeable template.',
    },
    tracklist: [{ label: 'Figma' }, { label: 'Design tokens' }],
    links: [
      {
        label: 'Figma file',
        href: 'https://www.figma.com/file/sVLBxIeqZxFLzCOxh0C8vw/onsite-support-landing-page-design-template-CURRENT',
        kind: 'figma',
      },
    ],
  },
  {
    slug: 'onsite-grid-framework',
    title: 'CSS Grid Framework',
    client: 'Threecolts',
    era: 'threecolts',
    engagement: 'contract',
    role,
    period: { start: '2023-06', end: '2024-11' },
    size: 'tall',
    treatment: 'swiss',
    layout: 'title-top',
    theme: 'mustard',
    motif: 'dot-grid-mark',
    media: { kind: 'artwork' },
    summary:
      'A custom CSS and grid framework that automates layouts across live support, FAQs, and media widgets.',
    body: {
      context: 'Dynamic content types each carried their own one-off layout code.',
      contribution:
        'Built a custom CSS and grid framework that lays out live support, FAQ, and media widgets automatically.',
      outcome: 'New content types drop into the grid without bespoke CSS.',
    },
    tracklist: [
      { label: 'CSS Grid' },
      { label: 'Live support' },
      { label: 'FAQs' },
      { label: 'Media widgets' },
    ],
  },
  {
    slug: 'responsive-modernization',
    title: '200+ Responsive Rebuilds',
    client: 'Threecolts',
    era: 'threecolts',
    engagement: 'contract',
    role,
    period: { start: '2023-06', end: '2024-11' },
    size: 'sm',
    treatment: 'standard',
    layout: 'title-top',
    theme: 'navy-coral',
    motif: 'scatter',
    media: { kind: 'placeholder', variant: 'mobile' },
    summary: 'Modernized over 200 non-responsive web properties into mobile-optimized layouts.',
    body: {
      context: 'Over 200 web properties were desktop-only.',
      contribution:
        'Rebuilt them as responsive, mobile-optimized layouts on the shared grid framework.',
      outcome: '200+ properties now work on phones and tablets.',
    },
    tracklist: [{ label: 'Properties', value: '200+' }, { label: 'Responsive CSS' }],
    metrics: [{ value: '200+', label: 'web properties made responsive' }],
  },
] as const satisfies readonly Project[];

/** Identity, contact, and education content for the identity poster and end-cap. */
export const HOME_TITLE = 'Eric Thayer — Career Timeline';
export const HOME_DESCRIPTION =
  'Fifteen-plus years of design systems, front-end platforms, and agentic engineering work by Eric Thayer, Principal Design Engineer.';

export const SITE = {
  name: 'Eric Thayer',
  role: 'Principal Design Engineer',
  location: 'Denver, CO',
  summary:
    'Design systems, agentic engineering workflows, and front-end platforms across React, Angular, and Vue.',
  span: { start: '2003-01', end: 'present' },
  highlights: ['Design systems', 'Agentic engineering', 'Front-end platforms'],
  links: [
    {
      label: 'Résumé',
      href: 'https://docs.google.com/document/d/1CG5F0XGEuR3ZWTTyU3i7L-wGu6gGtFXgkrhgAyKZcfM/edit?usp=sharing',
    },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ethayerdesign/' },
    { label: 'GitHub', href: 'https://github.com/ericthayer/' },
    { label: 'CodePen', href: 'https://codepen.io/ericthayer/' },
    { label: 'Email', href: 'mailto:ethayer.design@gmail.com' },
  ],
  education: [
    { degree: 'B.S. Media Arts', school: 'Platt College, San Diego', year: '2005' },
    { degree: 'A.A.S. Graphic Design', school: 'Platt College, San Diego', year: '2003' },
  ],
} as const;

/** Page title for a project, shared by the dialog and the prerendered head (FR-101). */
export const projectTitle = (title: string): string => `${title} — ${SITE.name}`;

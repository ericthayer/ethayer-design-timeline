/** Identity, contact, and education content for the hero and end-cap. */
export const SITE = {
  name: 'Eric Thayer',
  role: 'Principal Design Engineer',
  location: 'Denver, CO',
  summary:
    'Design systems, agentic engineering workflows, and front-end platforms across React, Angular, and Vue.',
  span: { start: '2003-01', end: 'present' },
  links: [
    // Opens <resume-dialog> (spec 002, FR-124)
    { label: 'Résumé', href: '/resume' },
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

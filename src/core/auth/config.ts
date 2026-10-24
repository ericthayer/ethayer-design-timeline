/** Admin sign-in constants (spec 004 admin-auth §4). Admin-only: public code never imports this. */
export const API_ORIGIN = 'https://api.github.com';
export const API_VERSION = '2022-11-28';

export const REPO = {
  owner: 'ericthayer',
  name: 'ethayer-design-timeline',
  branch: 'main',
} as const;

/** Only this GitHub account may sign in, compared case-insensitively (owner decision D6). */
export const ALLOWED_LOGIN = 'ericthayer';

export const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';
export const TOKEN_PREFIX = 'github_pat_';
export const RECOMMENDED_EXPIRY_DAYS = 30;

export const STORAGE_KEY = 'timeline:admin-session';

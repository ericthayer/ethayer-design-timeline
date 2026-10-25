/**
 * /admin entry (spec 004 admin-auth FR-343, FR-350, FR-354). Shows the sign-in panel, verifies a
 * token (or the stored one), mounts the admin island, and only then boots the public app.
 * Public code never imports this file (FR-341).
 */
import { AdminSignIn, define as defineSignIn } from '../components/admin-sign-in/admin-sign-in.ts';
import {
  AdminStatus,
  buildIsland,
  define as defineStatus,
  followModals,
} from '../components/admin-status/admin-status.ts';
import { patProvider, type AuthProvider } from '../core/auth/provider.ts';
import { announceSignedIn, type AdminSession } from '../core/auth/session.ts';
import { el } from '../core/dom.ts';

const provider: AuthProvider = patProvider();
const main = document.getElementById('main');

/**
 * The public app, unchanged. In a build it's the built public entry that admin.html preloads
 * (the admin graph is separate so public chunks stay byte-identical); in dev it's the source.
 */
function publicEntry(): string {
  const link = document.querySelector<HTMLLinkElement>('link[data-public-entry]');
  return link?.getAttribute('href') ?? '/src/main.ts';
}

/** Dev only: the site CSS normally arrives with main.ts, so load it before the panel renders. */
async function devStyles(): Promise<void> {
  if (import.meta.env.DEV) {
    await Promise.all([
      import('../styles/layers.css'),
      import('../styles/fonts.css'),
      import('../styles/tokens.css'),
      import('../styles/base.css'),
      import('../styles/header.css'),
    ]);
  }
}

async function boot(session: AdminSession): Promise<void> {
  defineStatus();
  const status = new AdminStatus();
  status.provider = provider;
  status.session = session;
  const island = buildIsland(status);
  document.body.append(island);
  followModals(island);
  main?.replaceChildren();
  // FR-357: focus moves to <main>; a deep-linked dialog then takes it (US-A6).
  main?.focus();
  try {
    await import(/* @vite-ignore */ publicEntry());
  } catch {
    main?.append(
      el('p', { class: 'noscript' }, ["Couldn't load the site. Reload the page to try again."]),
    );
    return;
  }
  announceSignedIn(session);
}

async function start(): Promise<void> {
  defineSignIn();
  await devStyles();
  const panel = new AdminSignIn();
  panel.mode = 'page';
  panel.persistent = provider.persistent;
  panel.signIn = (input) => provider.signIn(input);
  panel.addEventListener(
    'admin-sign-in:success',
    (event) => {
      void boot(event.detail);
    },
    { once: true },
  );
  // FR-343: until a session is verified, <main> holds only the sign-in panel.
  main?.replaceChildren(panel);

  panel.setPending('Checking with GitHub…');
  const restored = await provider.restore();
  panel.setPending(null);
  if (restored?.ok) {
    await boot(restored.session);
    return;
  }
  if (restored) panel.showError(restored);
}

void start();

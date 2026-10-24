/**
 * /admin entry (spec 004 admin-auth FR-343). Stub: sign-in and the gated boot land in T350.
 * Nothing here may be imported by public code (FR-341).
 */
import { el } from '../core/dom.ts';

/** The built public entry (admin.html's modulepreload), or the source module in dev. */
function publicEntry(): string {
  const link = document.querySelector<HTMLLinkElement>('link[data-public-entry]');
  return link?.getAttribute('href') ?? '/src/main.ts';
}

document.getElementById('main')?.append(el('p', {}, ['Admin sign-in arrives in T350.']));
if (location.search === '?boot') void import(/* @vite-ignore */ publicEntry());

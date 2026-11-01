/** A piece of one line of an answer (spec 005, FR-432). */
export type Inline =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'project'; readonly slug: string; readonly title: string }
  | { readonly type: 'link'; readonly label: string; readonly href: string };

/** One block of an answer. The client turns these into DOM with `textContent` only. */
export type Segment =
  | { readonly type: 'paragraph'; readonly parts: readonly Inline[] }
  | { readonly type: 'list'; readonly items: readonly (readonly Inline[])[] };

/** What tokens may resolve to: public projects by slug, and `site.json` links by label. */
export interface RenderRefs {
  readonly projects: ReadonlyMap<string, string>;
  readonly links: ReadonlyMap<string, string>;
}

const TOKEN = /\[\[(link:[^\]\n]{1,40}|[a-z0-9]+(?:-[a-z0-9]+)*)\]\]/g;
const LIST_ITEM = /^\s*-\s+/;

/** Drops a `[[` that never closes at the end of the text (a stream cut mid-token). */
function dropOpenToken(text: string): string {
  const open = text.lastIndexOf('[[');
  return open !== -1 && !text.includes(']]', open) ? text.slice(0, open) : text;
}

function resolve(token: string, refs: RenderRefs): Inline | null {
  if (token.startsWith('link:')) {
    const label = token.slice('link:'.length);
    const href = refs.links.get(label);
    return href === undefined ? null : { type: 'link', label, href };
  }
  const title = refs.projects.get(token);
  return title === undefined ? null : { type: 'project', slug: token, title };
}

/** Text with `[[…]]` tokens resolved. Unknown tokens are dropped; everything else stays text. */
export function parseInline(text: string, refs: RenderRefs): Inline[] {
  const parts: Inline[] = [];
  const pushText = (t: string): void => {
    if (t === '') return;
    const last = parts.at(-1);
    if (last?.type === 'text') parts[parts.length - 1] = { type: 'text', text: last.text + t };
    else parts.push({ type: 'text', text: t });
  };
  let from = 0;
  for (const match of text.matchAll(TOKEN)) {
    pushText(text.slice(from, match.index));
    const ref = resolve(match[1] ?? '', refs);
    if (ref !== null) parts.push(ref);
    from = match.index + match[0].length;
  }
  pushText(text.slice(from));
  return parts
    .map((p): Inline =>
      p.type === 'text' ? { type: 'text', text: p.text.replace(/\s+/g, ' ') } : p,
    )
    .filter((p) => p.type !== 'text' || p.text.trim() !== '');
}

/**
 * Model output → segments (FR-432): blank lines split blocks, `- ` lines make a list, and
 * `[[slug]]` / `[[link:Label]]` resolve against `refs`. No URL, markdown, or HTML is interpreted.
 */
export function parseAnswer(raw: string, refs: RenderRefs): Segment[] {
  const blocks = dropOpenToken(raw.replace(/\r\n?/g, '\n')).split(/\n\s*\n/);
  const segments: Segment[] = [];
  for (const block of blocks) {
    let prose: string[] = [];
    let items: Inline[][] = [];
    const flushProse = (): void => {
      const parts = parseInline(prose.join(' ').trim(), refs);
      if (parts.length > 0) segments.push({ type: 'paragraph', parts });
      prose = [];
    };
    const flushList = (): void => {
      if (items.length > 0) segments.push({ type: 'list', items });
      items = [];
    };
    for (const line of block.split('\n')) {
      if (LIST_ITEM.test(line)) {
        flushProse();
        const parts = parseInline(line.replace(LIST_ITEM, '').trim(), refs);
        if (parts.length > 0) items.push(parts);
      } else if (line.trim() !== '') {
        flushList();
        prose.push(line.trim());
      }
    }
    flushProse();
    flushList();
  }
  return segments;
}

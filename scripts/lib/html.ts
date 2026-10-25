/**
 * Escaping HTML template helper for build-time pages (FR-134). Interpolations are escaped unless
 * they come from another `html` call, so content is never concatenated into markup by hand.
 * Erasable TypeScript only: Node runs build scripts that import this without a compiler.
 */
const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

/** Markup that is already safe, so it passes through `html` unescaped. */
export class Raw {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}

export type Hole = string | number | Raw | null | undefined | false | Hole[];

function toHtml(hole: Hole): string {
  if (hole === null || hole === undefined || hole === false) return '';
  if (hole instanceof Raw) return hole.value;
  if (Array.isArray(hole)) return hole.map(toHtml).join('');
  return esc(String(hole));
}

export function html(strings: TemplateStringsArray, ...holes: Hole[]): Raw {
  let out = strings[0] ?? '';
  holes.forEach((hole, index) => {
    out += toHtml(hole) + (strings[index + 1] ?? '');
  });
  return new Raw(out);
}

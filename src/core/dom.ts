/** Typed DOM builders. Text goes through textContent only (constitution II.3). */
export type Attrs = Readonly<Record<string, string | number | boolean | undefined>>;
type Child = Node | string;

function applyAttrs(node: Element, attrs: Attrs): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
}

function append(node: Node, children: readonly Child[]): void {
  for (const child of children) {
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  append(node, children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: readonly Node[] = [],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs);
  append(node, children);
  return node;
}

/** querySelector that throws instead of returning null, for template slots that must exist. */
export function qs(root: ParentNode, selector: string): HTMLElement;
export function qs<T extends Element>(
  root: ParentNode,
  selector: string,
  type: abstract new () => T,
): T;
export function qs(
  root: ParentNode,
  selector: string,
  type: abstract new () => Element = HTMLElement,
): Element {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing element: ${selector}`);
  return found;
}

/** Clone a module-level template's content (plan §4). */
export function cloneTemplate(template: HTMLTemplateElement): DocumentFragment {
  return template.content.cloneNode(true) as DocumentFragment;
}

/** Build a <template> once from a factory. Content is created with the builders above. */
export function makeTemplate(build: () => readonly Node[]): () => HTMLTemplateElement {
  let cached: HTMLTemplateElement | undefined;
  return () => {
    if (!cached) {
      cached = document.createElement('template');
      append(cached.content, build());
    }
    return cached;
  };
}

/** Register a custom element once. */
export function defineOnce(name: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(name)) customElements.define(name, ctor);
}

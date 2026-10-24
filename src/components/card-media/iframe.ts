import type { IframeMedia } from '../../content/types.ts';
import { el } from '../../core/dom.ts';
import type { MediaLease } from '../../core/media-scheduler.ts';
import { renderPicture } from './image.ts';

const VIEWPORTS = { desktop: [1440, 900], mobile: [390, 844] } as const;
const LOAD_TIMEOUT_MS = 10_000;

/** One shared observer scales every card frame to cover its box (FR-032). */
let resizeObserver: ResizeObserver | undefined;
function observeScale(frame: HTMLElement, width: number, height: number): void {
  resizeObserver ??= new ResizeObserver((records) => {
    requestAnimationFrame(() => {
      for (const { target, contentRect } of records) {
        if (!(target instanceof HTMLElement)) continue;
        const w = Number(target.dataset['vw']);
        const h = Number(target.dataset['vh']);
        const scale = Math.max(contentRect.width / w, contentRect.height / h);
        target.style.setProperty('--frame-scale', scale.toFixed(4));
      }
    });
  });
  frame.dataset['vw'] = String(width);
  frame.dataset['vh'] = String(height);
  resizeObserver.observe(frame);
}

export interface RenderedFrame {
  readonly element: HTMLElement;
  readonly lease: MediaLease;
}

/** Non-interactive live preview: inert, sandboxed, poster until loaded (FR-032). */
export function renderCardFrame(media: IframeMedia, sizes: string): RenderedFrame {
  const [width, height] = VIEWPORTS[media.viewport];
  const frame = el('div', { class: 'media__frame', inert: true, 'aria-hidden': 'true' }, [
    renderPicture(media.poster, { sizes, className: 'media__poster' }),
  ]);
  observeScale(frame, width, height);

  let iframe: HTMLIFrameElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unmount = (): void => {
    clearTimeout(timer);
    iframe?.remove();
    iframe = undefined;
    delete frame.dataset['loaded'];
  };
  const mount = (): void => {
    if (iframe) return;
    iframe = el('iframe', {
      class: 'media__iframe',
      src: media.src,
      title: media.title,
      width,
      height,
      loading: 'lazy',
      scrolling: 'no',
      tabindex: '-1',
      sandbox: 'allow-scripts allow-same-origin',
      allow: '',
      referrerpolicy: 'strict-origin-when-cross-origin',
    });
    iframe.addEventListener('load', () => {
      clearTimeout(timer);
      frame.dataset['loaded'] = '';
    });
    timer = setTimeout(() => {
      if (!('loaded' in frame.dataset)) unmount();
    }, LOAD_TIMEOUT_MS);
    frame.append(iframe);
  };
  return { element: frame, lease: { kind: 'iframe', mount, unmount } };
}

/** Interactive dialog iframe (FR-052): real size, scrollable, still sandboxed. */
export function renderDialogFrame(media: IframeMedia): HTMLIFrameElement {
  return el('iframe', {
    class: 'hero__iframe',
    src: media.src,
    title: media.title,
    loading: 'lazy',
    sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms',
    allow: '',
    referrerpolicy: 'strict-origin-when-cross-origin',
  });
}

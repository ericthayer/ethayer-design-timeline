// Type-level guards (FR-035): `tsc --noEmit` fails if a forbidden pair becomes assignable.
import { describe, expect, it } from 'vitest';
import type { CardMedia, IframeMedia } from '../../src/content/types.ts';

const poster = { kind: 'image', src: 'dmns/cover', alt: 'poster' } as const;
const desktopFrame: IframeMedia<'desktop'> = {
  kind: 'iframe',
  src: 'https://example.com/',
  title: 't',
  viewport: 'desktop',
  poster,
};
const mobileFrame: IframeMedia<'mobile'> = { ...desktopFrame, viewport: 'mobile' };

// @ts-expect-error sm cards never take a live iframe
const smFrame: CardMedia<'sm'> = desktopFrame;
// @ts-expect-error tall cards take mobile-viewport iframes only
const tallDesktop: CardMedia<'tall'> = desktopFrame;
// @ts-expect-error wide cards take desktop-viewport iframes only
const wideMobile: CardMedia<'wide'> = mobileFrame;

const tallMobile: CardMedia<'tall'> = mobileFrame;
const featureDesktop: CardMedia<'feature'> = desktopFrame;

describe('size × media types', () => {
  it('compiles the allowed pairs', () => {
    expect([smFrame, tallDesktop, wideMobile, tallMobile, featureDesktop]).toHaveLength(5);
  });
});

# Research — 001 Timeline Wall

Date: 2026-10-23. Every finding below was checked against a live source in this session, unless it's marked as an assumption.

## R1. Reference layout: CodePen `ericthayer/pen/eRvPQx` ("Instagram Gallery")

| Finding | Detail |
| --- | --- |
| Markup | `.img-grid > .grid-item > a > img`, 24 items, square 600×600 sources |
| CSS | Not recoverable. The pen's styling lived in an external file (`s.cdpn.io/97621/functional-modifiers.css`), which now returns S3 `AccessDenied`. The pen's own CSS panel is empty, and Wayback was unreachable from here. |
| **Assumption A1** | The layout is a CSS Grid of square cells where some items span 2×2 and gaps are back-filled (`grid-auto-flow: dense`). |
| **Confirmed** (owner screenshot, 2026-10-23) | 6 equal square columns, a gap of about 8 px, 2×2 features in varied positions (columns 4–5, 1–2, 5–6), and 1×1 tiles back-filling around them. That's dense packing with full-bleed photos and no captions. The standard card treatment follows this, adding a label chip because each tile is a link that needs visible text. |

## R2. Visual reference: Swiss-style poster wall (attached image)

The attachment shows 18 album-cover posters done in the International Typographic Style. **We use the vocabulary, not the artwork.** All motifs are original generators. The source posters are third-party work and won't be reproduced.

### Poster anatomy (consistent across all 18)

```
┌────────────────────────────┐
│ Artist             44_     │  header: 2-line bold label (left), 2-line index numerals (right)
│ Name               06      │
│                            │
│ Title Display              │  title: bold grotesk, tight leading, top OR bottom
│                            │
│  ┌──────────────────────┐  │
│  │  geometric artwork   │  │  art: one motif repeated or transformed; flat color;
│  │  (grid / rotation /  │  │       one accent "outlier" element is common
│  │   halftone / overlap)│  │
│  └──────────────────────┘  │
│ 2015   Track ....... 4:12  │  footer: year (left) + 2-column track list with values
└────────────────────────────┘
```

### Design rules extracted

| Rule | Evidence in reference | Spec mapping |
| --- | --- | --- |
| Single grotesk family, 2–3 weights | All 18 | One variable font, weights 500/600/700 |
| Title position alternates top or bottom | 8 top, 10 bottom | `layout: 'title-top' \| 'title-bottom'` |
| Index numerals `NN_` / `NN` top-right | All | `start-yy_` / `end-yy` (present renders `→`) |
| Flat palette, 1 bg + 1–3 art colors | All | 16 themes (see data-model) |
| Motif = repetition + one deviation | Lost in the Dream (one black dot), Voyageur (one rotated bar) | The motif library has a seeded "outlier" parameter |
| Small footer type in 2 columns | All | `tracklist`: stack and metrics as label/value pairs |

### Accessibility deltas from the reference (required changes)

| Reference pairing | Contrast | Verdict | Our fix |
| --- | --- | --- | --- |
| White text on salmon | 3.05:1 | Fails AA for small text | Ink text on coral (6.14:1) |
| White text on mustard | 1.91:1 | Fails | Ink text on mustard (9.82:1) |
| Coral title on paper | ~3.6:1 | Large text only | `vermilionDeep` #B8301F (5.26:1) |

Artwork is decorative (`aria-hidden`), so SC 1.4.11 doesn't apply to motif fills.

## R3. Portfolio inventory (ethayer.design v5.5.0, Hugo/Netlify)

| Project | Year | Link | Asset available |
| --- | --- | --- | --- |
| QR Landing Page (Onsite Support) | 2023 | qrlanding.netlify.app | `github.com/ericthayer/qr-landing/raw/main/media/qr-landing-demo-04.png` |
| Vue Component Library (Health Scholars) | 2023 | hs-library.healthscholars.com (Storybook) | `img-hs-component-library.webp` |
| MadRamps (VEA Technologies) | 2021 | madramps.com | `img-portfolio-mad-ramps-home.webp` |
| Figma Design Template (Onsite Support) | 2023 | figma.com file | `img-figma-design-template.webp` |
| NYT UI (CodePen study) | 2021 | cdpn.io/pen/LYRMzdM | live iframe on current site |
| Denver Museum of Nature & Science | 2018 | dmns.netlify.app (+ `/pattern-library/`) | `img-16x9-DMNS.webp` |
| SubList Prototype (Adobe XD) | 2017 | xd.adobe.com view | `img-16x9-SubList-XD.webp` |
| Merchants Office Furniture (Sketch) | 2020 | merchantsofficefurniture.com | `img-portfolio-merchants-home-1.0.webp` |
| Curiteva | 2020 | (none) | `img-portfolio-curiteva-home-v1.4.webp` |
| Motion Demo Reel (post-production) | pre-2010 | ethayer.design/demo → Vimeo `143960525` | Vimeo only (source file needed for clips) |
| SafetyHive 2.0 (Figma prototype) | ? | figma.com proto | none (capture) |
| MAP Course Launcher (InVision Freehand) | ? | invisionapp.com | none (capture) |
| CodePen collection `dbqbZz` | — | codepen.io | — |

Resume sources: CoBank (Dec 2023–present), Threecolts / Onsite Support (Jun 2023–Nov 2024), Health Scholars (Dec 2017–Jul 2023), ethayer.design / KyaMedia (Jul 2015–Dec 2017), The Navigators (Jan 2011–Jul 2015), DLI / DOD (Jul 2010–Sep 2013), Platt College B.S. (2005) and A.A.S. (2003).

## R4. Iframe frameability (HTTP headers, probed 2026-10-23)

| URL | Status | `X-Frame-Options` / CSP `frame-ancestors` | Card iframe allowed? |
| --- | --- | --- | --- |
| dmns.netlify.app | 200 | none | **Yes** |
| dmns.netlify.app/pattern-library/ | 200 | none | **Yes** (dialog) |
| qrlanding.netlify.app | 200 | none | **Yes** |
| madramps.com | 200 | none | **Yes** |
| merchantsofficefurniture.com | 200 | none | **Yes** |
| hs-library.healthscholars.com | **403** | — | **No.** Gated or retired; use the screenshot |
| xd.adobe.com/view/… | 200 | `DENY` | **No.** Screenshot only |
| cdpn.io/pen/debug/… and codepen.io/…/embed/… | 403 to non-browser clients (Cloudflare) | `SAMEORIGIN` on challenge | **Unverified.** Re-test in a real browser (T060); fall back to screenshot or clip |
| player.vimeo.com | — | embeddable by design | Dialog only, behind a click-to-load facade |

Third-party sites can add frame blocking at any time. `scripts/check-frameable.ts` re-runs this probe in CI on a weekly schedule, and the card falls back to its `poster` when a site blocks framing.

## R5. Platform features used (all progressive unless marked required)

| Feature | Use | Status |
| --- | --- | --- |
| CSS Grid + `grid-auto-flow: dense` | Wall packing | Required. Baseline |
| Container queries + `cqi`/`cqb` units | Fluid cells, card typography | Required. Baseline 2023 |
| `<dialog>.showModal()` | Full-screen project view, focus containment, Esc | Required. Baseline |
| `inert` | Non-interactive card iframes | Required. Baseline 2023 |
| `:has()` | Scroll lock while dialog open | Required. Baseline 2023 |
| `dvh` units | Horizontal-mode wall height | Required. Baseline 2023 |
| Same-document View Transitions | Card → dialog morph | Progressive (fade fallback) |
| `animation-timeline: scroll()` | Era rail progress (P3) | Progressive (static fallback) |
| `navigator.connection.saveData` | Media gating | Progressive (Chromium only) |

## R6. Content discrepancies to resolve (become open questions in the spec)

1. **Freelance dates.** DMNS (2018), Merchants and Curiteva (2020), and MadRamps and NYT UI (2021) fall inside the Health Scholars tenure, but the resume ends ethayer.design / KyaMedia in Dec 2017.
2. **Curiteva.** The portfolio alt text says "Samples of some coded art done in CodePen", which doesn't match the name (a medical device company). The description needs fixing.
3. **NYT UI** is a personal UI study. It must be labeled "UI study", not presented as client work.
4. **CoBank and Threecolts internal tools** are probably under NDA. Default: generative artwork only, no screenshots.
5. **SafetyHive 2.0 and MAP Course Launcher** have no client or date context yet.
6. **Health Scholars Storybook** returns 403. Is it still live and shareable?

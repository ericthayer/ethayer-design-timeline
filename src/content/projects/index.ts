import type { Project } from '../types.ts';
import { cobank } from './cobank.ts';
import { earlyCareer } from './early-career.ts';
import { healthScholars } from './health-scholars.ts';
import { independent } from './independent.ts';
import { threecolts } from './threecolts.ts';

/** Authored order within each era is curated (spec A5). Era order comes from ERAS. */
export const PROJECTS: readonly Project[] = [
  ...cobank,
  ...threecolts,
  ...healthScholars,
  ...independent,
  ...earlyCareer,
];

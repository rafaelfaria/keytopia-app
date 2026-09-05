/**
 * The article prose, keyed by slug.
 *
 * Split into ten files of five consecutive publication days rather than one
 * enormous module, and grouped by day rather than by topic so that "is the
 * campaign complete?" is answerable by looking at the file list.
 *
 * Everything here is Markdown in the subset described by ../markdown.tsx. The
 * H1, the metadata and the publication date are NOT in these strings — they
 * live in ../posts.ts, so an article body starts at its opening paragraph.
 *
 * This module is heavy (roughly seventy thousand words). Only ../registry.ts
 * imports it, and only the lazily-loaded blog routes import that.
 */

import { DAYS_01_05 } from './days01-05';
import { DAYS_06_10 } from './days06-10';
import { DAYS_11_15 } from './days11-15';
import { DAYS_16_20 } from './days16-20';
import { DAYS_21_25 } from './days21-25';
import { DAYS_26_30 } from './days26-30';
import { DAYS_31_35 } from './days31-35';
import { DAYS_36_40 } from './days36-40';
import { DAYS_41_45 } from './days41-45';
import { DAYS_46_50 } from './days46-50';

export const BODIES: Record<string, string> = {
  ...DAYS_01_05,
  ...DAYS_06_10,
  ...DAYS_11_15,
  ...DAYS_16_20,
  ...DAYS_21_25,
  ...DAYS_26_30,
  ...DAYS_31_35,
  ...DAYS_36_40,
  ...DAYS_41_45,
  ...DAYS_46_50,
};

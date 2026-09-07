import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAllPatchDefinitions } from './patches/index';
import { SYSTEM_PROMPTS_DIR } from './config';

export type PatchFilterResult =
  { ok: true; filter: string[] | null } | { ok: false; error: string };

/**
 * Resolve and validate a comma-separated `--patches` argument against the known
 * patch IDs.
 *
 * The apply path matches the filter by inclusion, so an unknown ID (a typo)
 * would silently match nothing — the patch the caller meant to apply is skipped
 * with no warning. Agents drive `--patches` at showtime, so this validates
 * up-front and fails fast instead.
 *
 * @returns `{ filter }` with the cleaned IDs (or null = apply all), or an
 *   `{ error }` describing an unknown / empty filter.
 */
export function resolvePatchFilter(
  patchesArg: string | undefined | null
): PatchFilterResult {
  if (!patchesArg) return { ok: true, filter: null };

  const requested = patchesArg
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    return {
      ok: false,
      error: '--patches was provided but contained no patch IDs.',
    };
  }

  const validIds = new Set<string>(getAllPatchDefinitions().map(d => d.id));
  // System-prompt override ids are valid filter entries too: applySystemPrompts
  // filters by promptId (see patches/systemPrompts.ts), and --list-patches
  // advertises them. Accept any id that has an override file on disk.
  try {
    for (const f of fs.readdirSync(SYSTEM_PROMPTS_DIR)) {
      if (f.endsWith('.md')) validIds.add(path.basename(f, '.md'));
    }
  } catch {
    /* no overrides dir yet */
  }
  const unknown = requested.filter(id => !validIds.has(id));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `unknown patch ID(s) in --patches: ${unknown.join(', ')}`,
    };
  }

  return { ok: true, filter: requested };
}

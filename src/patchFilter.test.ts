import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolvePatchFilter } from './patchFilter';

// 'verbose-property' and 'read-default-lines' are stable always-applied IDs.
describe('resolvePatchFilter', () => {
  it('returns null filter (apply all) when no --patches given', () => {
    expect(resolvePatchFilter(undefined)).toEqual({ ok: true, filter: null });
    expect(resolvePatchFilter(null)).toEqual({ ok: true, filter: null });
    expect(resolvePatchFilter('')).toEqual({ ok: true, filter: null });
  });

  it('accepts valid IDs and trims/drops blanks', () => {
    expect(resolvePatchFilter('verbose-property,read-default-lines')).toEqual({
      ok: true,
      filter: ['verbose-property', 'read-default-lines'],
    });
    expect(resolvePatchFilter(' verbose-property , ')).toEqual({
      ok: true,
      filter: ['verbose-property'],
    });
  });

  it('rejects an unknown ID (a typo would otherwise silently apply nothing)', () => {
    const r = resolvePatchFilter('verbose-property,nonexistent-xyz');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('nonexistent-xyz');
  });

  it('rejects a filter that contains no usable IDs', () => {
    const r = resolvePatchFilter(' , , ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('no patch IDs');
  });

  it('accepts a system-prompt override id that has a file in the prompts dir', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tweakcc-filter-'));
    fs.mkdirSync(path.join(dir, 'system-prompts'));
    fs.writeFileSync(
      path.join(dir, 'system-prompts', 'system-prompt-harness-instructions.md'),
      ''
    );
    vi.stubEnv('TWEAKCC_CONFIG_DIR', dir);
    vi.resetModules();
    try {
      const { resolvePatchFilter: fresh } = await import('./patchFilter');
      expect(
        fresh('system-prompt-harness-instructions,verbose-property')
      ).toEqual({
        ok: true,
        filter: ['system-prompt-harness-instructions', 'verbose-property'],
      });
      const r = fresh('system-prompt-not-on-disk');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('system-prompt-not-on-disk');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

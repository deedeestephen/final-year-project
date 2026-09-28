import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Vitest runs from the admin-panel-web folder.
const css = readFileSync('src/index.css', 'utf8');

/** Colour tokens declared on :root in index.css. */
function tokens(): Record<string, string> {
  const root = /:root\s*{([^}]*)}/.exec(css)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const t = tokens();
const WHITE = '#ffffff';

// [foreground, background, where it is used]
const TEXT_PAIRS: [string, string, string][] = [
  [t.ink, t.canvas, 'headings on the canvas'],
  [t['ink-2'], t.surface, 'body text on cards'],
  [t['ink-secondary'], t.surface, 'lead text'],
  [t['ink-secondary'], t.canvas, 'table headers'],
  [t['ink-muted'], t.surface, 'hints and timestamps on cards'],
  [t['ink-muted'], t.canvas, 'hints on the canvas'],
  [t.primary, t.surface, 'links and emerald text'],
  [t['on-primary'], t.primary, 'primary button'],
  [t['on-primary'], t['primary-pressed'], 'primary button, pressed'],
  [WHITE, t.ink, 'secondary (slate) button and selected filter'],
  [t.primary, t['positive-bg'], 'Active badge'],
  [
    t['primary-pressed'],
    t['positive-bg'],
    'success notice and active menu item',
  ],
  [t.warning, t['warning-bg'], 'Locked badge and warnings'],
  [t['offline-ink'], t['offline-bg'], 'offline banner'],
  [t.danger, t['danger-bg'], 'error notice and Disabled badge'],
  [t.danger, t.surface, 'danger button text'],
  [t.ink, t['surface-subtle'], 'numbers in count tiles'],
  [t['ink-secondary'], t['surface-subtle'], 'labels in count tiles'],
];

describe('design tokens (WCAG 2.1 AA)', () => {
  it('declares every token the checks need', () => {
    for (const [fg, bg, where] of TEXT_PAIRS) {
      expect(fg, where).toMatch(/^#[0-9a-f]{6}$/);
      expect(bg, where).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(TEXT_PAIRS)('%s on %s (%s) reaches 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps bright emerald and amber for decoration only', () => {
    // These fail AA as text on white, which is why text uses the deeper tones.
    expect(contrast(t['primary-accent'], WHITE)).toBeLessThan(4.5);
    expect(contrast(t['warning-accent'], WHITE)).toBeLessThan(4.5);
  });
});

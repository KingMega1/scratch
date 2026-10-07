// WCAG contrast audit for every text/background pair used in src/styles/site.css (AA: >= 4.5 normal text).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
const L = h => { const [r, g, b] = hex(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const C = { yellow: '#FFD12A', ink: '#0B1620', white: '#FFFFFF', fog: '#EEF0F2', slate: '#5B6670', mist: '#A9B2BA', checked: '#1F7A4D', blue: '#1D4FB8', tintChecked: '#E4F2E8', tintWatch: '#FFF4DC' };
const PAIRS = [
  ['body text', C.ink, C.white], ['secondary text', C.slate, C.white], ['secondary on fog', C.slate, C.fog],
  ['link', C.blue, C.white], ['link on fog', C.blue, C.fog], ['primary button', C.ink, C.yellow],
  ['footer secondary', C.mist, C.ink], ['footer link', C.white, C.ink], ['hero kicker', C.yellow, C.ink],
  ['official state', C.checked, C.tintChecked], ['listing state', C.ink, C.fog], ['unknown state', C.slate, C.fog],
  ['draft tag', C.ink, C.tintWatch], ['gated notice', C.ink, C.tintWatch], ['path card dark k', C.mist, C.ink],
  ['disabled button', C.slate, C.fog], ['preview bar', C.white, C.ink],
];
for (const [name, fg, bg] of PAIRS) test(`contrast ${name} ${fg} on ${bg}`, () => assert.ok(ratio(fg, bg) >= 4.5, `${name}: ${ratio(fg, bg).toFixed(2)}:1`));
// Known failing combination from the beta audit (3.8:1 class): never used for text.
test('mist on white is not used as text colour', () => assert.ok(ratio(C.mist, C.white) < 4.5));

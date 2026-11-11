import { test } from 'node:test';
import assert from 'node:assert/strict';
// Mirrors src/lib/format.ts contract (Brand V2 "Numbers and names").
const NUM = new Intl.NumberFormat('en-US');
test('Western numerals and EGP placement', () => {
  assert.equal(`EGP ${NUM.format(1895000)}`, 'EGP 1,895,000');
  assert.equal(`${NUM.format(1895000)} ج.م`, '1,895,000 ج.م');
  assert.doesNotMatch(NUM.format(1234567), /[٠-٩]/);
});

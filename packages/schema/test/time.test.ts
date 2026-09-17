import { describe, expect, test } from 'bun:test';
import { Schema } from 'effect';
import { PlainTime, endOf, startOf } from '../src/time.ts';

const decode = Schema.decodeUnknownSync(PlainTime);
const encode = Schema.encodeSync(PlainTime);

describe('PlainTime', () => {
  test('day precision decodes to PlainDate', () => {
    const t = decode('2021-03-15');
    expect(t instanceof Temporal.PlainDate).toBe(true);
    expect(encode(t)).toBe('2021-03-15');
  });
  test('month precision decodes to PlainYearMonth', () => {
    const t = decode('2021-03');
    expect(t instanceof Temporal.PlainYearMonth).toBe(true);
    expect(encode(t)).toBe('2021-03');
    expect(startOf(t).toString()).toBe('2021-03-01');
    expect(endOf(t).toString()).toBe('2021-03-31');
  });
  test('rejects other shapes with a readable message', () => {
    expect(() => decode('2021')).toThrow(/day \(2021-03-15\) or month/);
    expect(() => decode('2021-13')).toThrow();
    expect(() => decode(20210315)).toThrow();
  });
});

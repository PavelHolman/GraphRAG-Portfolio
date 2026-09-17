import { describe, expect, test } from 'bun:test';
import { sinceYear } from '../src/lib/sections/model.ts';

describe('sinceYear', () => {
  test('takes the earliest Experience start', () => {
    expect(
      sinceYear([
        Temporal.PlainYearMonth.from('2024-05'),
        Temporal.PlainYearMonth.from('2020-03'),
        Temporal.PlainYearMonth.from('2026-06'),
      ]),
    ).toBe('2020');
  });
  test('accepts day precision', () => {
    expect(sinceYear([Temporal.PlainDate.from('2021-09-01')])).toBe('2021');
  });
  test('is undefined without any Experience', () => {
    expect(sinceYear([])).toBe(undefined);
  });
});

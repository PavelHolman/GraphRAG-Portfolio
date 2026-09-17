import { Effect, Option, Schema, SchemaGetter, SchemaIssue } from 'effect';

/** Authored time: `2021-03-15` (day) or `2021-03` (month). ADR 0001. */
export type PlainTime = Temporal.PlainDate | Temporal.PlainYearMonth;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

const isPlainTime = (u: unknown): u is PlainTime =>
  u instanceof Temporal.PlainDate || u instanceof Temporal.PlainYearMonth;

const parse = (s: string): Effect.Effect<PlainTime, SchemaIssue.Issue> =>
  Effect.try({
    try: (): PlainTime => {
      if (DAY_RE.test(s)) return Temporal.PlainDate.from(s);
      if (MONTH_RE.test(s)) return Temporal.PlainYearMonth.from(s);
      // eslint-plugin rule allows no throw here: signal via a Temporal parse of an invalid string.
      return Temporal.PlainDate.from(s);
    },
    catch: () =>
      new SchemaIssue.InvalidValue(
        {
          message: `expected an ISO date at day (2021-03-15) or month (2021-03) precision, got ${JSON.stringify(s)}`,
        },
        Option.some(s),
      ),
  });

/** Decodes an ISO string into `Temporal.PlainDate` or `Temporal.PlainYearMonth`; encodes back to the same string. */
export const PlainTime = Schema.String.pipe(
  Schema.decodeTo(Schema.declare(isPlainTime, { title: 'PlainTime' }), {
    decode: SchemaGetter.transformEffect(parse),
    encode: SchemaGetter.transform((t: PlainTime) => t.toString()),
  }),
);

/** First day covered by an authored time. */
export const startOf = (t: PlainTime): Temporal.PlainDate =>
  t instanceof Temporal.PlainDate ? t : t.toPlainDate({ day: 1 });

/** Last day covered by an authored time. */
export const endOf = (t: PlainTime): Temporal.PlainDate =>
  t instanceof Temporal.PlainDate ? t : t.toPlainDate({ day: t.daysInMonth });

export const compareStart = (a: PlainTime, b: PlainTime): number =>
  Temporal.PlainDate.compare(startOf(a), startOf(b));

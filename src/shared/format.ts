const LIGHT_YEARS_PER_PARSEC = 3.26156;

export function parsecToLightYears(parsec: number): number {
  return parsec * LIGHT_YEARS_PER_PARSEC;
}

export function kelvinToCelsius(kelvin: number): number {
  return kelvin - 273.15;
}

/** Fills the `{name}` places of a text: `fill("{n} days", { n: 12 })` gives "12 days". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (place, name: string) => (name in values ? String(values[name]) : place));
}

/** The words a period is written with, each with the place of its number: "{n} days". */
export interface PeriodWords {
  days: string;
  years: string;
}

/** Writes numbers, dates and periods the way one language does. */
export interface Formatters {
  /** A whole number with thousands separators, so 6470 becomes "6,470". */
  count: (value: number) => string;
  /**
   * A number with about three significant digits: 1234.5 becomes "1,235", 12.345 becomes "12.3" and
   * 0.01234 becomes "0.0123".
   */
  number: (value: number) => string;
  /** A date in UTC, for example "November 14, 2026". */
  date: (date: Date) => string;
  /** A date and time in UTC, for example "November 14, 2026 at 7:53 PM UTC". */
  dateTime: (date: Date) => string;
  /** An orbital period in days, or in years from two years up. */
  period: (days: number) => string;
}

/** The formatters of a language. `intl` is its tag for numbers and dates, such as "de-DE". */
export function formatters(intl: string, words: PeriodWords): Formatters {
  const integer = new Intl.NumberFormat(intl);
  // Dates are shown in UTC so every visitor and every server prints the same text.
  const dateFormat = new Intl.DateTimeFormat(intl, { dateStyle: "long", timeZone: "UTC" });
  const dateTimeFormat = new Intl.DateTimeFormat(intl, { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  const number = (value: number) => {
    const abs = Math.abs(value);
    const options: Intl.NumberFormatOptions =
      abs >= 100
        ? { maximumFractionDigits: 0 }
        : abs >= 1
          ? { maximumFractionDigits: abs >= 10 ? 1 : 2 }
          : { maximumSignificantDigits: 3 };
    return new Intl.NumberFormat(intl, options).format(value);
  };
  return {
    count: (value) => integer.format(value),
    number,
    date: (date) => dateFormat.format(date),
    dateTime: (date) => `${dateTimeFormat.format(date)} UTC`,
    period: (days) => (days < 730 ? fill(words.days, { n: number(days) }) : fill(words.years, { n: number(days / 365.25) })),
  };
}

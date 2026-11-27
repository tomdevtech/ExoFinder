/**
 * One labelled value of a body, as plain text: the pages and the printed catalogue show the same rows.
 * A value of null reads "unknown", so the reader can tell a missing measurement from a forgotten row.
 */
export interface FactRow {
  label: string;
  value: string | null;
  /** A short remark on the value, for example "calculated". */
  note?: string | null;
}

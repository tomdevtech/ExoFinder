import type { Messages } from "@/i18n/messages";

/** Which planets of a list its page shows, such as " · showing 201–400". Empty when the list fits on one page. */
export function rangeText(m: Messages, page: number, pageSize: number, shown: number, total: number): string {
  if (total <= pageSize) return "";
  const first = (page - 1) * pageSize + 1;
  return m.list.range(first, first + shown - 1);
}

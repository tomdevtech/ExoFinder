import type { ClientMessages } from "@/i18n/messages";
import { fill, parsecToLightYears, type Formatters } from "@/shared/format";

type MapText = ClientMessages["map"];

export function distanceText(parsec: number, text: MapText, fmt: Formatters): string {
  return fill(text.distance, { n: fmt.number(parsecToLightYears(parsec)) });
}

export function planetsText(count: number, text: MapText): string {
  return count === 1 ? text.planetsOne : fill(text.planetsOther, { n: count });
}

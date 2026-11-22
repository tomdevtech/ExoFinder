import { formatNumber, parsecToLightYears } from "@/shared/format";

export function distanceText(parsec: number): string {
  return `${formatNumber(parsecToLightYears(parsec))} light-years from the Sun`;
}

export function planetsText(count: number): string {
  return count === 1 ? "1 known planet" : `${count} known planets`;
}

import type { ClimateClass, PlanetClass } from "./classify";

/** The classes from the smallest to the largest. Their names are in the texts of each language (i18n/messages). */
export const PLANET_CLASS_ORDER: PlanetClass[] = ["rocky", "super_earth", "neptune_like", "gas_giant"];

/** From the coldest to the hottest. */
export const CLIMATE_CLASS_ORDER: ClimateClass[] = ["frozen", "cold", "temperate", "hot", "scorching"];

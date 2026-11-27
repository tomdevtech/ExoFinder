import { Link } from "@/i18n/client";
import { getMessages } from "@/i18n/server";
import type { ClimateClass, PlanetClass } from "./classify";
import { CLIMATE_CLASS_ORDER, PLANET_CLASS_ORDER } from "./labels";
import { NO_FILTER, type TypeFilter } from "./typeFilter";

// The climates are written in lower case elsewhere; `first-letter` needs a block to capitalise them here.
const CHIP = "inline-block rounded-full border px-3 py-1 transition-colors first-letter:uppercase";
const CHIP_OFF = `${CHIP} border-line text-muted`;
const CHIP_ON = `${CHIP} border-accent/60 bg-surface font-medium text-foreground`;

/**
 * The chips that narrow a list to a kind of planet: one row for the class, one for the climate. Each chip
 * is a link to the same list with that part of the filter set, and the chosen chip leads back to the list
 * without it, so the filter works before JavaScript has loaded and can be shared as an address.
 */
export async function TypeFilters({
  filter = NO_FILTER,
  href,
}: {
  filter?: TypeFilter;
  /**
   * The address of the list with the given filter. Without it the chips are drawn without their links, for
   * the placeholder that shows until the address is known.
   */
  href?: (filter: TypeFilter) => string;
}) {
  const { list, classes } = await getMessages();
  return (
    <nav aria-label={list.filterNav} className="flex flex-col gap-2.5 text-sm">
      <Row<PlanetClass>
        label={list.type}
        remove={list.removeFilter}
        options={PLANET_CLASS_ORDER.map((value) => ({ value, label: classes.label[value] }))}
        chosen={filter.planetClass}
        href={href && ((planetClass) => href({ ...filter, planetClass }))}
      />
      <Row<ClimateClass>
        label={list.climate}
        remove={list.removeFilter}
        options={CLIMATE_CLASS_ORDER.map((value) => ({ value, label: classes.climate[value] }))}
        chosen={filter.climateClass}
        href={href && ((climateClass) => href({ ...filter, climateClass }))}
      />
    </nav>
  );
}

function Row<Value extends string>({
  label,
  remove,
  options,
  chosen,
  href,
}: {
  label: string;
  /** What the chosen chip says it does when it is clicked. */
  remove: string;
  options: { value: Value; label: string }[];
  chosen: Value | null;
  href: ((value: Value | null) => string) | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-muted">{label}</span>
      {options.map((option) =>
        !href ? (
          <span key={option.value} className={CHIP_OFF}>
            {option.label}
          </span>
        ) : option.value === chosen ? (
          <Link
            key={option.value}
            href={href(null)}
            prefetch={false}
            scroll={false}
            aria-current="true"
            title={remove}
            className={`${CHIP_ON} hover:border-accent`}
          >
            {option.label}
            <span aria-hidden className="ml-1.5 text-muted">
              ✕
            </span>
          </Link>
        ) : (
          <Link
            key={option.value}
            href={href(option.value)}
            prefetch={false}
            scroll={false}
            className={`${CHIP_OFF} hover:border-accent/60 hover:text-foreground`}
          >
            {option.label}
          </Link>
        ),
      )}
    </div>
  );
}

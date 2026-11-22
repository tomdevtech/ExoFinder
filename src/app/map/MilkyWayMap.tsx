"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { slugify } from "@/shared/slug";
import { Finder } from "./Finder";
import { BUTTON, PANEL } from "./panelStyles";
import type { MapPlanet, MapStar, MapStarsPayload, MapSystemPayload } from "./payload";
import { MapEngine } from "./scene/engine";
import { SPECIAL_STAR } from "./specialStar";
import { StarPanel } from "./StarPanel";
import { SystemPanel } from "./SystemPanel";

/**
 * The Milky Way map page: panels, search and links around the `MapEngine` canvas.
 * The current view is mirrored in the URL so it can be linked, for example
 * `/map?star=trappist-1`, `/map?system=sun&planet=saturn&moon=titan` or `/map?view=galaxy`. The scale
 * and whether the moons and the habitable zone are shown are part of it too (`scale=true`, `moons=off`,
 * `zone=on`), so nothing has to be stored in the browser.
 */
export default function MilkyWayMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  /**
   * We read the router's search params instead of `window.location`, because after
   * a client-side navigation the effects run before Next has updated the URL.
   */
  const searchParams = useSearchParams();

  const [stars, setStars] = useState<MapStar[] | null>(null);
  const [problem, setProblem] = useState<"webgl" | "stars" | null>(null);
  /** The index into `stars` of the selected star. */
  const [selected, setSelected] = useState<number | null>(null);
  /** The system being viewed, or null while the galaxy is shown. */
  const [system, setSystem] = useState<MapSystemPayload | null>(null);
  /** The slug of the system that is currently loading. */
  const [entering, setEntering] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** The index into `system.planets` of the planet the camera follows. */
  const [planet, setPlanet] = useState<number | null>(null);
  /** The moon the camera follows: an index into the planet's `moons`, or past them into its `smallMoons`. */
  const [moon, setMoon] = useState<number | null>(null);
  /** Whether the system is drawn in the true scale instead of the compressed one. */
  const [trueScale, setTrueScale] = useState(false);
  /** Whether the moons of a followed planet are shown. */
  const [moons, setMoons] = useState(true);
  /** Whether the habitable zone of the system's star is shown. */
  const [zone, setZone] = useState(false);
  /** Whether the panel of a system is folded away, to see the whole picture. */
  const [panelHidden, setPanelHidden] = useState(false);
  /** Whether the camera circles the galactic centre instead of flying freely. */
  const [orbiting, setOrbiting] = useState(false);
  const [paused, setPaused] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  /** Returns keyboard focus to the map so that the flight keys keep working after a button click. */
  const focusMap = () => containerRef.current?.focus({ preventScroll: true });

  async function enterSystem(
    slug: string,
    planetSlug: string | null = null,
    moonSlug: string | null = null,
    view: { trueScale: boolean; moons: boolean; zone: boolean } = { trueScale, moons, zone },
  ) {
    const engine = engineRef.current;
    setEntering(slug);
    setFailed(false);
    try {
      const response = await fetch(`/map/systems/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as MapSystemPayload;
      // Drop the result if the map was left or recreated while the system was loading.
      if (!engine || engineRef.current !== engine) return;
      const index = planetSlug ? payload.planets.findIndex((p) => p.slug === planetSlug) : -1;
      const focus = index >= 0 ? index : null;
      const moonIndex = focus !== null && moonSlug ? moonSlugs(payload.planets[focus]).indexOf(moonSlug) : -1;
      const moonFocus = moonIndex >= 0 ? moonIndex : null;
      engineRef.current?.showSystem(payload, focus, view.moons ? moonFocus : null, { paused, ...view });
      setSystem(payload);
      setPlanet(focus);
      setMoon(view.moons ? moonFocus : null);
      setTrueScale(view.trueScale);
      setMoons(view.moons);
      setZone(view.zone);
    } catch {
      setFailed(true);
    } finally {
      setEntering(null);
    }
  }

  function leaveSystem() {
    engineRef.current?.showGalaxy();
    setSystem(null);
    setPlanet(null);
    setMoon(null);
    focusMap();
  }

  function selectStar(index: number | null, fly = false) {
    engineRef.current?.select(index);
    if (index !== null && fly) engineRef.current?.flyToStar(index);
    setSelected(index);
    setFailed(false);
  }

  function focusPlanet(index: number | null, moonIndex: number | null = null) {
    engineRef.current?.focusPlanet(index, moonIndex);
    setPlanet(index);
    setMoon(moonIndex);
  }

  const handleEscape = useEffectEvent(() => {
    if (system) leaveSystem();
    else selectStar(null);
  });

  /** Shows the star, system or view named in the URL that the page was opened with. */
  const openLink = useEffectEvent((loaded: MapStar[]) => {
    const link = searchParams;
    const engine = engineRef.current;
    if (!engine) return;
    const systemSlug = link.get("system");
    const starSlug = systemSlug ?? link.get("star");
    const index = starSlug ? loaded.findIndex((star) => star[0] === starSlug) : -1;
    if (index >= 0) {
      engine.select(index);
      engine.flyToStar(index, true);
      setSelected(index);
    } else if (link.get("view") === "galaxy") {
      engine.flyToOverview(true);
    }
    if (systemSlug) {
      void enterSystem(systemSlug, link.get("planet"), link.get("moon"), {
        trueScale: link.get("scale") === "true",
        moons: link.get("moons") !== "off",
        zone: link.get("zone") === "on",
      });
    }
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const engine = MapEngine.create(container, {
      onSelect: (index) => {
        setSelected(index);
        setFailed(false);
      },
      onFocus: (index, moonIndex) => {
        setPlanet(index);
        setMoon(moonIndex);
      },
      onEscape: () => handleEscape(),
      onOrbit: (on) => setOrbiting(on),
    });
    if (!engine) {
      setProblem("webgl");
      return;
    }
    engineRef.current = engine;
    container.focus({ preventScroll: true });

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/map/stars");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as MapStarsPayload;
        if (cancelled) return;
        // The easter-egg star at the galactic centre is not in the catalogue, so it is added here.
        const loaded = [...payload.stars, SPECIAL_STAR];
        engine.setStars(loaded);
        setStars(loaded);
        openLink(loaded);
      } catch {
        if (!cancelled) setProblem("stars");
      }
    })();

    return () => {
      cancelled = true;
      engineRef.current = null;
      engine.dispose();
      // Next keeps a page that was left alive but hidden (React Activity) and reruns
      // this effect with a new engine on return. The state is reset so that the view
      // comes from the new URL and not from the previous visit.
      setStars(null);
      setSelected(null);
      setSystem(null);
      setPlanet(null);
      setMoon(null);
      setTrueScale(false);
      setMoons(true);
      setZone(false);
      setEntering(null);
      setFailed(false);
      setOrbiting(false);
    };
  }, []);

  // Mirror the current view in the URL so that it can be shared. While a system is
  // loading the URL is left alone, so it never names a view that is not shown yet.
  useEffect(() => {
    if (!stars || entering) return;
    const params = new URLSearchParams();
    if (system) {
      params.set("system", system.star.slug);
      if (planet !== null) params.set("planet", system.planets[planet].slug);
      if (planet !== null && moon !== null) params.set("moon", moonSlugs(system.planets[planet])[moon]);
      if (trueScale) params.set("scale", "true");
      if (!moons) params.set("moons", "off");
      if (zone) params.set("zone", "on");
    } else if (selected !== null) {
      params.set("star", stars[selected][0]);
    }
    const query = params.toString();
    // Next.js takes a call of replaceState for a navigation of its own, which cancels one the visitor has
    // just started by clicking a link. So the address is only written when the view has changed, and only
    // while the map is still the page shown.
    const address = query ? `/map?${query}` : "/map";
    const { pathname, search } = window.location;
    if (pathname === "/map" && pathname + search !== address) window.history.replaceState(null, "", address);
  }, [stars, entering, system, planet, moon, trueScale, moons, zone, selected]);

  if (problem === "webgl") {
    return (
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className={`${PANEL} max-w-md p-6`}>
          <h2 className="text-lg font-semibold">The map needs WebGL 2</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            This browser cannot draw 3D graphics, or they are switched off. Every star and planet
            also has its own page: use the search above, or start with{" "}
            <Link className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current" href="/stars/sun">
              the solar system
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const star = stars && selected !== null ? stars[selected] : null;

  return (
    <>
      <div
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-label={
          system
            ? `3D view of ${system.star.name} and its planets. Drag to turn, scroll to zoom.`
            : "3D map of the Milky Way. Drag to look around, fly with W, A, S and D."
        }
        className="absolute inset-0 outline-none"
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3 sm:p-4">
        <div className="flex min-h-0 items-start justify-between gap-3">
          <div className="pointer-events-auto flex max-h-full w-full max-w-xs min-w-0 flex-col gap-3">
            {system && panelHidden ? (
              <button type="button" className={`${BUTTON} self-start backdrop-blur`} onClick={() => setPanelHidden(false)}>
                » Show panel
              </button>
            ) : system ? (
              <SystemPanel
                system={system}
                planet={planet}
                moon={moon}
                paused={paused}
                trueScale={trueScale}
                moons={moons}
                zone={zone}
                onScale={(next) => {
                  engineRef.current?.setTrueScale(next);
                  setTrueScale(next);
                }}
                onZone={(next) => {
                  engineRef.current?.setHabitableZoneShown(next);
                  setZone(next);
                }}
                onMoons={(next) => {
                  engineRef.current?.setMoonsShown(next);
                  setMoons(next);
                  if (!next) setMoon(null);
                }}
                onFocus={(index, moonIndex) => {
                  focusPlanet(index, moonIndex);
                  focusMap();
                }}
                onPause={(next) => {
                  engineRef.current?.setPaused(next);
                  setPaused(next);
                }}
                onLeave={leaveSystem}
                onHide={() => setPanelHidden(true)}
              />
            ) : (
              <>
                {stars && (
                  <Finder
                    stars={stars}
                    onChoose={(index) => {
                      selectStar(index, true);
                      focusMap();
                    }}
                  />
                )}
                {star && (
                  <StarPanel
                    star={star}
                    entering={entering === star[0]}
                    failed={failed}
                    onFly={() => {
                      engineRef.current?.flyToStar(selected!);
                      focusMap();
                    }}
                    onEnter={() => {
                      // Move the camera next to the star first, so that leaving the system returns there.
                      engineRef.current?.flyToStar(selected!, true);
                      void enterSystem(star[0]);
                    }}
                    onClose={() => {
                      selectStar(null);
                      focusMap();
                    }}
                  />
                )}
                {!stars && problem === null && (
                  <p className={`${PANEL} px-4 py-3 text-sm text-muted`} aria-live="polite">
                    Loading the stars…
                  </p>
                )}
                {problem === "stars" && (
                  <p className={`${PANEL} px-4 py-3 text-sm leading-6`} role="alert">
                    The stars could not be loaded. Is the database running?
                  </p>
                )}
              </>
            )}
          </div>

          {!system && (
            <div className="pointer-events-auto flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className={BUTTON}
                onClick={() => {
                  engineRef.current?.flyHome();
                  focusMap();
                }}
              >
                Sun
              </button>
              <button
                type="button"
                className={BUTTON}
                onClick={() => {
                  engineRef.current?.flyToOverview();
                  focusMap();
                }}
              >
                Whole galaxy
              </button>
              <button
                type="button"
                className={BUTTON}
                aria-pressed={orbiting}
                title={orbiting ? "Fly freely again" : "Turn round the centre of the Milky Way"}
                onClick={() => {
                  engineRef.current?.setOrbit(!orbiting);
                  focusMap();
                }}
              >
                {orbiting ? "Fly freely" : "Orbit centre"}
              </button>
            </div>
          )}
        </div>

        {/* How to steer is in the map's accessible name and in the user guide, and the sources of the
            pictures are on the credits page, so the corner keeps only the links the site footer has. */}
        <div className="flex justify-end text-xs leading-5 text-muted [text-shadow:0_0_4px_#000]">
          <p className="pointer-events-auto">
            <Link className="hover:text-foreground" href="/credits">
              Credits
            </Link>
            {" · "}
            {/* The site footer is hidden on the map, so its legal links are repeated here. */}
            <Link className="hover:text-foreground" href="/legal/notice">
              Legal notice
            </Link>
            {" · "}
            <Link className="hover:text-foreground" href="/legal/privacy">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * The address names of a planet's moons in the order of the list: the large moons by their slug, then the
 * small ones by their name ("S/2004 S 12" becomes `s-2004-s-12`).
 */
function moonSlugs(planet: MapPlanet): string[] {
  return [...planet.moons.map((moon) => moon.slug), ...planet.smallMoons.map(([name]) => slugify(name))];
}

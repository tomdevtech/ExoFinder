"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Lets the left and right arrow keys lead to the previous and the next body of the catalogue. */
export function BrowseKeys({ previous, next }: { previous: string | null; next: string | null }) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.key === "ArrowLeft" ? previous : event.key === "ArrowRight" ? next : null;
      if (!target) return;
      // The arrow keys belong to whatever has the focus: they turn the 3D model and move the cursor in the
      // search field. They only browse while nothing else can claim them, or from the links of BrowseNav.
      const focused = document.activeElement;
      if (focused && focused !== document.body && !focused.closest("[data-browse-nav]")) return;
      router.push(target);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, previous, next]);

  return null;
}

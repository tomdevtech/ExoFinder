import { notFound } from "next/navigation";

/**
 * Catches every address below a language that no page answers. Without it Next.js would look for a
 * not-found page above the language, where there is no layout to show it in.
 */
export default function UnknownPage() {
  notFound();
}

import { Link } from "@/i18n/client";
import { getMessages } from "@/i18n/server";

/** Shown for unknown URLs and when a page calls `notFound()`. */
export default async function NotFound() {
  const { notFound } = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start gap-4 px-6 py-14">
      <h1 className="text-3xl font-semibold tracking-tight">{notFound.title}</h1>
      <p className="max-w-xl leading-7 text-muted">{notFound.text}</p>
      <Link href="/" className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current">
        {notFound.back}
      </Link>
    </main>
  );
}

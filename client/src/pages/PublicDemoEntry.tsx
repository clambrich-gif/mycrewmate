import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect } from "react";

/** Fallback für bereits geöffnete Links aus einer früheren Vorschauversion. */
export default function PublicDemoEntry() {
  const token = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";

  useEffect(() => {
    if (!token) return;
    window.location.replace(`/api/public-demo/access?token=${encodeURIComponent(token)}`);
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-[0_22px_54px_-36px_rgba(15,23,42,0.36)]">
        {token ? (
          <>
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-black">Deine Testumgebung wird geöffnet …</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Die echte App wird mit fiktiven Daten vorbereitet. Das dauert nur einen Moment.</p>
          </>
        ) : (
          <>
            <AlertCircle className="mx-auto size-10 text-orange-500" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-black">Dieser Demo-Link ist nicht mehr gültig.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Starte einfach eine neue fiktive Demo.</p>
            <a href="/vereinsdemo" className="mt-6 inline-flex"><Button className="rounded-xl bg-slate-950 text-white hover:bg-blue-700">Neue Vereinsdemo starten</Button></a>
          </>
        )}
      </section>
    </main>
  );
}

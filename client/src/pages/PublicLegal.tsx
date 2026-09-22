import { Button } from "@/components/ui/button";
import { APP_LOGIN_URL } from "@/lib/site-host";
import { ArrowLeft, ExternalLink, Scale, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

const WORDMARK = "/brand/mycrewmate-wordmark.png";

type PublicLegalPageProps = {
  kind: "impressum" | "datenschutz";
};

function PublicLegalShell({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Scale;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50/80 text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="MyCrewMate – zur Startseite">
            <img src={WORDMARK} alt="MyCrewMate" className="h-8 w-auto sm:h-9" />
          </Link>
          <a href={APP_LOGIN_URL}>
            <Button type="button" className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
              Zum Login
            </Button>
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <ArrowLeft className="size-4" aria-hidden="true" /> Zurück zur Produktseite
        </Link>
        <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="size-5" aria-hidden="true" /></span>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
          </div>
          <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700">{children}</div>
        </article>
      </section>
    </main>
  );
}

export function PublicImpressumPage() {
  return (
    <PublicLegalShell icon={Scale} title="Impressum">
      <section>
        <h2 className="text-base font-bold text-slate-950">Angaben gemäß § 5 DDG</h2>
        <address className="mt-2 not-italic">
          MyCrewMate.de<br />
          Christian Lambrich<br />
          Eichenweg 4<br />
          56729 Nachtsheim<br />
          Deutschland
        </address>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">Kontakt</h2>
        <p className="mt-2">
          Telefon: <a className="text-blue-700 underline underline-offset-2" href="tel:+491745111984">0174 5111984</a><br />
          E-Mail: <a className="text-blue-700 underline underline-offset-2" href="mailto:clambrich@gmail.com">clambrich@gmail.com</a>
        </p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">Umsatzsteuer</h2>
        <p className="mt-2">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet und ausgewiesen (Kleinunternehmerregelung).</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">Redaktionell verantwortlich</h2>
        <p className="mt-2">Christian Lambrich, Eichenweg 4, 56729 Nachtsheim</p>
      </section>
      <section className="border-t border-slate-200 pt-6">
        <h2 className="text-base font-bold text-slate-950">Hinweis zur Musterseite</h2>
        <p className="mt-2">Diese Produktseite zeigt eine unverbindliche Musterdemo. Die dargestellten Preise, Warenkorb- und Checkout-Schritte dienen ausschließlich der Veranschaulichung. Es entsteht kein Vertrag; es werden keine Bestellungen oder Zahlungen entgegengenommen.</p>
      </section>
      <section className="border-t border-slate-200 pt-6">
        <h2 className="text-base font-bold text-slate-950">Urheberrecht</h2>
        <p className="mt-2">© 2026 MyCrewMate.de · Alle Rechte vorbehalten.</p>
      </section>
    </PublicLegalShell>
  );
}

export function PublicPrivacyPage() {
  return (
    <PublicLegalShell icon={ShieldCheck} title="Datenschutz">
      <section>
        <h2 className="text-base font-bold text-slate-950">1. Verantwortlicher</h2>
        <p className="mt-2">Christian Lambrich, Eichenweg 4, 56729 Nachtsheim, Deutschland. E-Mail: <a className="text-blue-700 underline underline-offset-2" href="mailto:clambrich@gmail.com">clambrich@gmail.com</a></p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">2. Zweck und Umfang</h2>
        <p className="mt-2">Diese öffentliche Musterseite dient ausschließlich der Produktinformation. Sie enthält keinen Newsletter, kein Kontaktformular, keine Zahlungsabwicklung und keine Analyse- oder Werbetracker. Der dargestellte Warenkorb und Checkout sind lokal simuliert; eingegebene Musterdaten werden nicht an einen Server übertragen und nicht gespeichert.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">3. Technische Zugriffe</h2>
        <p className="mt-2">Beim Aufruf einer Website verarbeitet der Hosting-Anbieter technisch erforderliche Verbindungsdaten in Serverprotokollen, insbesondere IP-Adresse, Zeitpunkt, angeforderte Seite und technische Browserinformationen. Die Verarbeitung erfolgt zur Bereitstellung und Sicherheit der Website auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">4. Login zur Vereins- und Eventplanung</h2>
        <p className="mt-2">Der Button „Zum Login“ führt auf die getrennte Anwendung unter <a className="text-blue-700 underline underline-offset-2" href={APP_LOGIN_URL}>{APP_LOGIN_URL}</a>. Für die dortige Nutzung gelten die Datenschutzhinweise der Anwendung. Auf dieser Produktseite selbst werden keine Login-Daten erfasst.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">5. Rechte betroffener Personen</h2>
        <p className="mt-2">Sie haben nach Maßgabe der DSGVO insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Widerspruch und Datenübertragbarkeit sowie das Recht auf Beschwerde bei einer Datenschutzaufsichtsbehörde.</p>
      </section>
      <section className="border-t border-slate-200 pt-6">
        <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Diese Datenschutzerklärung beschreibt den bewusst tracker- und formularfreien Startauftritt. Sie ist vor einer späteren Ergänzung um Kontaktformular, Newsletter, Analyse oder Zahlungsdienste entsprechend anzupassen.</p>
      </section>
    </PublicLegalShell>
  );
}

export default function PublicLegalPage({ kind }: PublicLegalPageProps) {
  return kind === "impressum" ? <PublicImpressumPage /> : <PublicPrivacyPage />;
}

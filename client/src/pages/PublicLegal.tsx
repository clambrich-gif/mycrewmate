import { Button } from "@/components/ui/button";
import { APP_LOGIN_URL } from "@/lib/site-host";
import { ArrowLeft, ExternalLink, Printer, Scale, ShieldCheck } from "lucide-react";
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
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50/80 text-slate-950 print:bg-white">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="https://mycrewmate.de/" className="shrink-0" aria-label="MyCrewMate – zur Hauptwebsite">
            <img src={WORDMARK} alt="MyCrewMate" className="h-8 w-auto sm:h-9" />
          </a>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              data-slot="public-legal-print"
              className="rounded-xl"
              onClick={() => window.print()}
            >
              <Printer className="size-4" aria-hidden="true" /> Drucken
            </Button>
            <a href={APP_LOGIN_URL}>
              <Button type="button" className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                Zum Login
              </Button>
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 print:max-w-none print:p-0">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 print:hidden">
          <ArrowLeft className="size-4" aria-hidden="true" /> Zurück zur Produktseite
        </Link>
        <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9 print:mt-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
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
          E-Mail: <a className="text-blue-700 underline underline-offset-2" href="mailto:info@mycrewmate.de">info@mycrewmate.de</a>
        </p>
        <p className="mt-3 text-xs leading-5 text-slate-500">MyCrewMate.de ist eine eigenständige Plattform für Vereins- und Eventplanung und steht in keiner Verbindung zu gleichnamigen Angeboten anderer Betreiber.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">Umsatzsteuer</h2>
        <p className="mt-2">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet und ausgewiesen (Kleinunternehmerregelung).</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">Wirtschafts-Identifikationsnummer</h2>
        <p className="mt-2">Wirtschafts-Identifikationsnummer gemäß § 139c AO: DE428034222</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">Redaktionell verantwortlich</h2>
        <p className="mt-2">Christian Lambrich, Eichenweg 4, 56729 Nachtsheim</p>
      </section>
      <section className="border-t border-slate-200 pt-6">
        <h2 className="text-base font-bold text-slate-950">Hinweis zum Pilotprogramm</h2>
        <p className="mt-2">Die öffentliche Seite informiert über MyCrewMate, das unverbindliche Pilotprogramm und die künftigen Paketpreise. Eine Pilotanfrage ist keine Bestellung: Es entsteht kein Vertrag, keine Zahlungspflicht und keine automatische Verlängerung. Paket, Laufzeit und ein möglicher weiterer Einsatz werden ausschließlich persönlich vereinbart.</p>
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
        <p className="mt-2">Christian Lambrich, Eichenweg 4, 56729 Nachtsheim, Deutschland. Datenschutzkontakt: <a className="text-blue-700 underline underline-offset-2" href="mailto:info@mycrewmate.de">info@mycrewmate.de</a></p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">2. Zweck und Umfang</h2>
        <p className="mt-2">Die öffentliche Website dient der Produktinformation, der unverbindlichen Pilotanfrage und der fiktiven Vereinsdemo. Sie enthält keinen Newsletter, keine Zahlungsabwicklung und keine Analyse- oder Werbetracker Dritter.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">2.1 Anonyme Reichweitenmessung</h2>
        <p className="mt-2">Damit wir nachvollziehen können, welche öffentlichen Bereiche grundsätzlich genutzt werden, zählen wir Aufrufe der Startseite, Pilotseite, sichtbaren Pilotanfrage, Vereinsdemo sowie bewusst gestartete Demo- und Pilotvideos als zusammengefasste Tageswerte. Gespeichert werden ausschließlich Aufrufart, Kalendertag und Anzahl.</p>
        <p className="mt-2">Dabei speichern wir keine IP-Adressen, Cookies, Gerätekennungen, Browsermerkmale oder Besucherprofile. Wiederholte Aufrufe können gezählt werden; einzelne Personen lassen sich daraus nicht erkennen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO für die datensparsame Weiterentwicklung unseres öffentlichen Angebots. Die Tageswerte werden höchstens zwei Jahre aufbewahrt und anschließend automatisch gelöscht.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">2.2 Unverbindliche Pilotanfrage</h2>
        <p className="mt-2">Wenn Sie eine Pilotanfrage absenden, verarbeiten wir Vereins- oder Organisationsname, Name der Ansprechperson, E-Mail-Adresse, Testanlass und gewünschten Startmonat. Diese Angaben sind erforderlich, damit wir Ihre Anfrage beantworten, einen möglichen Pilotzeitraum abstimmen und den Verlauf nachvollziehbar bearbeiten können. Die Telefonnummer sowie weitere Angaben zum Vorhaben sind freiwillig; die Telefonnummer verwenden wir nur für einen gewünschten persönlichen Rückruf. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO für vorvertragliche Kommunikation sowie Art. 6 Abs. 1 lit. f DSGVO für die geordnete Bearbeitung und Missbrauchsabwehr.</p>
        <p className="mt-2">Die Anfrage wird in der MyCrewMate-Datenbank gespeichert. Die strukturierte Benachrichtigung an das Pilotteam und die automatische Eingangsbestätigung werden über das bei Hetzner Online GmbH geführte Mailpostfach versandt. Die Datenbankanfrage bleibt bis zur dokumentierten Entscheidung aktiv und wird anschließend drei Jahre aufbewahrt; danach wird sie technisch gelöscht. Einen vorzeitigen Löschwunsch können Sie jederzeit an <a className="text-blue-700 underline underline-offset-2" href="mailto:info@mycrewmate.de">info@mycrewmate.de</a> richten. Erforderliche E-Mail-Korrespondenz wird im Mailpostfach nach derselben Frist organisatorisch bereinigt, soweit keine rechtliche Pflicht entgegensteht.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">2.3 Vereinbarter Pilotzugang</h2>
        <p className="mt-2">Kommt ein Pilotzugang zustande, werden die für die vereinbarte Vereins- und Eventplanung erforderlichen Daten in der Anwendung verarbeitet. Nach dem vereinbarten Pilotende wird der Zugang archiviert; die Daten bleiben für drei Jahre reaktivierbar und werden danach technisch gelöscht. Einen vorzeitigen Löschwunsch können Sie jederzeit an <a className="text-blue-700 underline underline-offset-2" href="mailto:info@mycrewmate.de">info@mycrewmate.de</a> richten. Für die Verarbeitung von Helfer- und weiteren Vereinsdaten im Pilotzugang werden die konkreten Rollen, Vereinbarungen und Datenschutzhinweise vor der Freischaltung mit dem Verein abgestimmt.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">2.4 Vereinsdemo mit fiktiven Daten</h2>
        <p className="mt-2">Die Vereinsdemo öffnet eine zeitlich begrenzte, eigene Testumgebung der MyCrewMate-Anwendung mit fiktiven Vereins-, Helfer-, Kontakt-, Standort- und Streckendaten. Tester können darin beispielhaft Helfer, Aufgaben oder Schichten ändern. Die Testumgebung wird beim Beenden der Demo und, falls das technisch nicht übermittelt werden kann, spätestens innerhalb von 45 Minuten nach ihrer Anlage automatisch gelöscht. Bitte verwenden Sie ausschließlich erfundene Namen und Kontaktdaten. Es findet keine individuelle Herkunfts- oder Nutzungsanalyse statt.</p>
        <p className="mt-2">Kurzzeitig in technische Sicherungskopien gelangte fiktive Demodaten werden nicht zur Wiederherstellung oder erneuten Öffnung einer Vereinsdemo verwendet. Die Sicherungskopien rotieren mit höchstens sieben täglichen Wiederherstellungspunkten.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-slate-950">3. Technische Zugriffe</h2>
        <p className="mt-2">Beim Aufruf einer Website verarbeitet der Hosting-Anbieter technisch erforderliche Verbindungsdaten in Serverprotokollen, insbesondere IP-Adresse, Zeitpunkt, angeforderte Seite und technische Browserinformationen. Die Verarbeitung erfolgt zur Bereitstellung und Sicherheit der Website auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Die öffentliche Produktseite wird auf Infrastruktur der Hetzner Online GmbH in Deutschland betrieben.</p>
        <p className="mt-2">Technische Server-, Container- und Reverse-Proxy-Protokolle werden auf dem Produktionsserver höchstens 14 Tage aufbewahrt und anschließend durch die konfigurierte Journalrotation entfernt. Eine individuelle Besucheranalyse findet nicht statt; die Access-Log-Funktion des Reverse Proxys ist nicht aktiviert. Sicherheits-, Login- und Aktivitätsprotokolle innerhalb der MyCrewMate-Anwendung werden höchstens zwölf Monate gespeichert und anschließend automatisch bereinigt. Kurzlebige Sicherheitsdaten wie abgelaufene Einladungen, Übergaben und Sitzungswiderrufe werden spätestens nach 30 Tagen entfernt.</p>
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
        <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Diese Datenschutzerklärung beschreibt die aktuelle öffentliche Website mit Pilotanfrage und fiktiver Vereinsdemo. Für Newsletter, Analyse, Zahlungsdienste oder weitere Formulare wird sie vor deren Einsatz entsprechend ergänzt.</p>
      </section>
    </PublicLegalShell>
  );
}

export default function PublicLegalPage({ kind }: PublicLegalPageProps) {
  return kind === "impressum" ? <PublicImpressumPage /> : <PublicPrivacyPage />;
}

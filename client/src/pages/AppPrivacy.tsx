import { Button } from "@/components/ui/button";
import { APP_LOGIN_URL } from "@/lib/site-host";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";

const WORDMARK = "/brand/mycrewmate-wordmark.png";
const PRIVACY_CONTACT = "info@mycrewmate.de";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export default function AppPrivacy() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50/80 text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a
            href="https://mycrewmate.de"
            className="shrink-0"
            aria-label="MyCrewMate – zur Startseite"
          >
            <img
              src={WORDMARK}
              alt="MyCrewMate"
              className="h-8 w-auto sm:h-9"
            />
          </a>
          <a href={APP_LOGIN_URL}>
            <Button
              type="button"
              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              Zum Login
            </Button>
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <a
          href="https://mycrewmate.de"
          className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Zurück zur
          Produktseite
        </a>
        <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Datenschutz für die MyCrewMate-App
            </h1>
          </div>
          <p className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
            Diese Hinweise gelten für die geschützte Vereins- und Eventplanung
            unter
            <strong> app.mycrewmate.de</strong>. Für die öffentliche
            Produktseite gilt der separate Datenschutzhinweis unter
            mycrewmate.de/datenschutz.
          </p>

          <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700">
            <Section title="1. Ansprechpartner für Datenschutz">
              <p>
                Verantwortlicher für den Betrieb der MyCrewMate-Plattform und
                für die eigenen Plattformprozesse ist Christian Lambrich,
                Eichenweg 4, 56729 Nachtsheim, Deutschland. Datenschutzanfragen
                können an{" "}
                <a
                  className="font-semibold text-blue-700 underline underline-offset-2"
                  href={`mailto:${PRIVACY_CONTACT}`}
                >
                  {PRIVACY_CONTACT}
                </a>{" "}
                gerichtet werden.
              </p>
              <p>
                Für Helfer-, Ansprechpartner- und Veranstaltungsdaten eines
                Vereins ist regelmäßig der jeweilige Verein datenschutzrechtlich
                Verantwortlicher. MyCrewMate verarbeitet diese Mandantendaten im
                Auftrag des Vereins, soweit dies im Auftragsverarbeitungsvertrag
                vereinbart ist. Eigene Plattformzwecke, etwa Sicherheit,
                Vertragsverwaltung und Abrechnung, bleiben davon getrennt.
              </p>
            </Section>

            <Section title="2. Welche Daten die App verarbeitet">
              <p>
                Je nach freigeschaltetem Funktionsumfang verarbeitet die App
                Kontaktdaten und Zugangsdaten, Vereins- und Veranstaltungsdaten,
                Helfer- und Ansprechpartnerdaten, Verfügbarkeiten, Schichten,
                Aufgaben, Standortangaben, Material- und Finanzplanungsdaten
                sowie freiwillig eingetragene Hinweise. Freitextfelder sollen
                nicht für besondere Kategorien personenbezogener Daten genutzt
                werden, sofern dafür keine dokumentierte Notwendigkeit besteht.
              </p>
              <p>
                Für die sichere Nutzung entstehen außerdem technische Daten,
                etwa Protokolle zu Anmeldungen, Rechteänderungen, Importen,
                Löschungen und Wiederherstellungen. Einladungs- und
                Passwort-Reset-Links sind für den jeweiligen Zweck bestimmt und
                nur begrenzt nutzbar.
              </p>
            </Section>

            <Section title="3. Zwecke und Rechtsgrundlagen">
              <p>
                Vereine nutzen die Daten zur Vorbereitung, Durchführung und
                Nachbereitung ihrer Veranstaltungen, zur Helferkoordination
                sowie zur Kommunikation im Organisationsteam. Die jeweils
                maßgebliche Rechtsgrundlage legt der Verein als Verantwortlicher
                fest, beispielsweise Art. 6 Abs. 1 lit. b, c oder f DSGVO.
                MyCrewMate verarbeitet diese Daten im Rahmen von Art. 28 DSGVO
                nach dokumentierter Weisung.
              </p>
              <p>
                MyCrewMate verarbeitet erforderliche technische Sicherheits-,
                Fehler- und Missbrauchsschutzdaten auf Grundlage des
                berechtigten Interesses nach Art. 6 Abs. 1 lit. f DSGVO, um die
                Anwendung sicher, verfügbar und nachvollziehbar zu betreiben.
                Soweit eine Verarbeitung für einen Vertrag oder gesetzliche
                Pflichten erforderlich ist, gelten zusätzlich Art. 6 Abs. 1 lit.
                b bzw. c DSGVO.
              </p>
            </Section>

            <Section title="4. Betrieb, E-Mail und Speicherung">
              <p>
                Die Anwendung wird auf Infrastruktur in Deutschland betrieben.
                Für den Betrieb werden ein Webserver mit Coolify, eine Datenbank
                sowie ein geschütztes Upload-Volume für Vereins- und
                Veranstaltungsdateien genutzt. Der Versand von Einladungen,
                Passwort-Resets und sonstigen transaktionalen E-Mails erfolgt
                über den Maildienst von Hetzner. Dabei werden insbesondere
                Empfängeradresse, Name, Betreff, Nachricht und gegebenenfalls
                ein einmaliger Zugangslink verarbeitet.
              </p>
              <p>
                Es sind derzeit keine automatisierten externen
                Infrastruktur-Backups eingerichtet. Manuelle Sicherungen und
                spätere automatisierte Backups werden erst nach einem
                gesonderten Backup-, Zugriffs- und Löschkonzept eingesetzt.
                Diese Datenschutzerklärung wird bei einer Änderung des
                Backup-Verfahrens aktualisiert.
              </p>
            </Section>

            <Section title="5. Karten, Standortlinks und externe Kommunikation">
              <p>
                Die optionale Live-Karte lädt Kartenkacheln von OpenStreetMap
                und OpenTopoMap. Beim Aufruf einer Kartenansicht übermittelt der
                Browser technisch erforderliche Verbindungsdaten, insbesondere
                IP-Adresse, Browserdaten, die aufgerufenen Kacheln und
                regelmäßig die Herkunftsseite, an den jeweiligen Kartenanbieter.
                Die Kartenfunktion dient der übersichtlichen Planung von
                Veranstaltungsorten und Strecken. Die Verarbeitung erfolgt auf
                Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Die Kartenansicht
                sollte nur für sachlich erforderliche Standort- und
                Streckeninformationen verwendet werden.
              </p>
              <p>
                Standortlinks in persönlichen PDF-Übersichten führen zu
                OpenStreetMap. Erst durch einen bewussten Klick wird die externe
                Seite geöffnet. Die Informationen zu OpenStreetMap und
                OpenTopoMap sind unter{" "}
                <a
                  className="text-blue-700 underline underline-offset-2"
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenStreetMap
                </a>{" "}
                und{" "}
                <a
                  className="text-blue-700 underline underline-offset-2"
                  href="https://opentopomap.org/about"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenTopoMap
                </a>{" "}
                abrufbar.
              </p>
              <p>
                Der WhatsApp-Button öffnet ausschließlich nach einem bewussten
                Klick einen WhatsApp-Chat. Dabei werden die Zielrufnummer und –
                bei Nutzung einer Vorlage – der vorbereitete Nachrichtentext an
                WhatsApp übergeben. Vereine entscheiden selbst, ob sie diese
                freiwillige Kommunikationsmöglichkeit einsetzen; eine manuelle
                Kontaktaufnahme bleibt möglich.
              </p>
            </Section>

            <Section title="6. Persönliche PDF-Übersichten">
              <p>
                Eine über einen persönlichen Freigabelink erreichbare
                Einsatzübersicht enthält nur den Namen der empfangenden Person,
                ihre eigenen Einsätze mit Tag, Zeit, Aufgabe und Ort sowie einen
                neutralen Hinweis auf die Einsatzleitung. Namen von
                Mithelfenden, private Hinweise, Spenden-, Verfügbarkeits- und
                Kontaktdaten anderer Personen werden in dieser öffentlichen
                Minimalansicht nicht ausgegeben.
              </p>
              <p>
                Ausführlichere PDF-Ansichten bleiben dem angemeldeten
                Organisationsteam mit den jeweils erteilten Rechten vorbehalten.
              </p>
            </Section>

            <Section title="7. Speicherfristen und Löschung">
              <p>
                Aktive Planungsdaten werden während der laufenden Vereins- und
                Veranstaltungsorganisation gespeichert. Für abgeschlossene
                Veranstaltungen ist als reguläre Frist eine Aufbewahrung von
                drei Jahren ab Veranstaltungsabschluss vorgesehen. Der Verein
                kann eine frühere Löschung veranlassen, wenn keine weitere
                fachliche oder rechtliche Notwendigkeit besteht.
              </p>
              <p>
                Gesetzliche Aufbewahrungspflichten gehen vor: insbesondere
                können buchhaltungs- oder steuerrelevante Unterlagen längere
                Fristen erfordern. Die konkrete Einordnung und Frist legt der
                jeweilige Verein mit seiner Buchhaltung oder Steuerberatung
                fest. Die Drei-Jahres-Frist wird im geschlossenen Pilotbetrieb
                dokumentiert; eine vollständige automatisierte Löschung aller
                Datenklassen wird vor dem breiten Regelbetrieb zusätzlich
                technisch eingeführt und getestet.
              </p>
            </Section>

            <Section title="8. Rechte betroffener Personen">
              <p>
                Betroffene Personen haben nach Maßgabe der DSGVO insbesondere
                Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der
                Verarbeitung, Datenübertragbarkeit und Widerspruch. Bei
                Planungsdaten richten sie sich zunächst an den jeweiligen
                Verein. Für Fragen zum Plattformbetrieb oder zur Unterstützung
                bei einer Anfrage ist MyCrewMate über{" "}
                <a
                  className="font-semibold text-blue-700 underline underline-offset-2"
                  href={`mailto:${PRIVACY_CONTACT}`}
                >
                  {PRIVACY_CONTACT}
                </a>{" "}
                erreichbar.
              </p>
              <p>
                Es besteht außerdem ein Beschwerderecht bei einer
                Datenschutzaufsichtsbehörde; für den Betreiber ist insbesondere
                der Landesbeauftragte für den Datenschutz und die
                Informationsfreiheit Rheinland-Pfalz zuständig.
              </p>
            </Section>

            <section className="border-t border-slate-200 pt-6">
              <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <ExternalLink
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                Version 1.0 · Stand: 01.10.2026. Dieser Hinweis beschreibt den
                geschlossenen Pilotbetrieb und wird bei neuen Funktionen,
                Dienstleistern oder verbindlichen betrieblichen Änderungen
                aktualisiert.
              </p>
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}

import { COPYRIGHT_NOTICE } from "@shared/branding";
import { ExternalLink, Scale } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const PRIVACY_POLICY_URL = "https://mycrewmate.de/datenschutz";
export const SIDEBAR_COPYRIGHT_NOTICE =
  "© 2026 MyCrewMate.de · Alle Rechte vorbehalten.";

type ImpressumDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type LegalFooterLinksProps = {
  onOpenImpressum: () => void;
  className?: string;
  compact?: boolean;
};

/** Einheitliche, öffentlich erreichbare Anbieterkennzeichnung. */
export function ImpressumDialog({ open, onOpenChange }: ImpressumDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white p-0 text-slate-900 sm:max-w-xl">
        <DialogHeader className="sticky top-0 z-10 border-b bg-white px-5 py-4 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-xl text-slate-950">
            <Scale className="h-5 w-5 text-blue-700" aria-hidden="true" />
            Impressum
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-5 py-5 text-sm leading-relaxed text-slate-700 sm:px-6 sm:py-6">
          <section>
            <h2 className="text-base font-semibold text-slate-950">IMPRESSUM</h2>
            <p className="mt-2 font-medium text-slate-900">Angaben gemäß § 5 DDG:</p>
            <address className="mt-1 not-italic">
              MyCrewMate.de<br />
              Christian Lambrich<br />
              Eichenweg 4<br />
              56729 Nachtsheim<br />
              Deutschland
            </address>
          </section>

          <section>
            <h2 className="font-semibold text-slate-950">Kontakt:</h2>
            <p className="mt-1">
              Telefon: <a className="text-blue-700 underline underline-offset-2 hover:text-blue-900" href="tel:+491745111984">0174 5111984</a><br />
              E-Mail: <a className="text-blue-700 underline underline-offset-2 hover:text-blue-900" href="mailto:clambrich@gmail.com">clambrich@gmail.com</a><br />
              Website: <a className="text-blue-700 underline underline-offset-2 hover:text-blue-900" href="https://mycrewmate.de" target="_blank" rel="noreferrer">https://mycrewmate.de</a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-950">Umsatzsteuer:</h2>
            <p className="mt-1">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet und ausgewiesen (Kleinunternehmerregelung).</p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-950">Redaktionell verantwortlich:</h2>
            <p className="mt-1">
              Christian Lambrich<br />
              Eichenweg 4<br />
              56729 Nachtsheim
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-950">EU-Streitschlichtung:</h2>
            <p className="mt-1">
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
              <a className="inline-flex items-center gap-1 text-blue-700 underline underline-offset-2 hover:text-blue-900" href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer">
                https://ec.europa.eu/consumers/odr/
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-950">Verbraucherstreitbeilegung/Universalschlichtungsstelle:</h2>
            <p className="mt-1">Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
          </section>

          <section className="border-t border-slate-200 pt-4">
            <h2 className="font-semibold text-slate-950">Urheberrechtshinweis:</h2>
            <p className="mt-1">{COPYRIGHT_NOTICE}</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Kompakte Rechtslinks für Login, Desktop-Seitenleiste und mobile Navigation. */
export function LegalFooterLinks({
  onOpenImpressum,
  className,
  compact = false,
}: LegalFooterLinksProps) {
  return (
    <div
      className={cn(
        compact
          ? "flex items-center justify-center gap-0.5 whitespace-nowrap text-[9px] leading-none"
          : "flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] leading-none",
        className
      )}
    >
      <button
        type="button"
        className={cn(
          "rounded px-1 underline-offset-2 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          compact ? "px-0 text-[9px] leading-none text-gray-400" : "text-slate-500"
        )}
        onClick={onOpenImpressum}
      >
        Impressum
      </button>
      <span aria-hidden="true" className="text-slate-300">
        ·
      </span>
      <a
        className={cn(
          "rounded px-1 underline-offset-2 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          compact ? "px-0 text-[9px] leading-none text-gray-400" : "text-slate-500"
        )}
        href={PRIVACY_POLICY_URL}
        target="_blank"
        rel="noreferrer"
      >
        Datenschutz
      </a>
    </div>
  );
}

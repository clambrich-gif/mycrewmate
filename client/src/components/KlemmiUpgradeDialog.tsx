import { KlemmiMascot } from "@/components/KlemmiMascot";
import { getKlemmiFeatureContext, type KlemmiFeatureContextId } from "@/lib/klemmi-feature-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRODUCT_PACKAGE_META,
  requiredUpgradePackageForCapability,
  type ProductCapability,
  type ProductPackageId,
} from "@shared/product-packages";
import { CheckCircle2, LockKeyhole, Sparkles } from "lucide-react";

const CAPABILITY_LABEL: Record<ProductCapability, string> = {
  additional_events: "Mehrere Veranstaltungen",
  event_years: "Weitere Veranstaltungsjahre",
  event_deletion: "Veranstaltungen verwalten",
  contacts: "Ansprechpartner",
  helpers: "Helferplanung",
  schedule: "Einsatzplanung",
  preparation: "Vorbereitung",
  postprocessing: "Nachbereitung",
  materials: "Materialplanung",
  donations: "Spendenverwaltung",
  finances: "Finanzübersicht",
  pdf: "PDF-Ausgabe",
  locations: "Orte & Standorte",
  chat: "Team-Chat",
  personal_accesses: "Persönliche Teamzugänge",
  excel: "Excel-Import und -Export",
  project_backup: "Projektstände und Sicherungen",
  marketing: "Marketingplanung",
  approvals: "Genehmigungsplanung",
  maps_gpx: "Live-Karte und GPX-Strecken",
  custom_branding: "eigene Event- und PDF-Logos",
  whatsapp_templates: "automatische WhatsApp-Vorlagen",
  event_backup: "Event-Sicherung",
};

const UPGRADE_BENEFITS: Record<ProductPackageId, readonly string[]> = {
  event_pass: ["Eine klar abgegrenzte Einzelveranstaltung"],
  light: [
    "Bis zu 150 Helfer und fünf persönliche Teamzugänge",
    "Ansprechpartner, Orte, Material sowie Vor- und Nachbereitung",
    "Persönliche Helfer-PDFs und WhatsApp-Standardaktion",
  ],
  pro: [
    "Bis zu fünf Veranstaltungen pro Jahr",
    "Live-Chat, Spenden, Finanzen sowie vollständige Vereinsplanung",
    "Live-Standortkarte, GPS-Punkte und GPX-Strecken",
  ],
  enterprise: [
    "Individuell vereinbarte Mengen, Prozesse und Erweiterungen",
    "Mehrveranstaltungs- und Verbandslösungen nach Bedarf",
  ],
};

type KlemmiUpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPackageId: ProductPackageId;
  capability: ProductCapability | null;
  contextId?: KlemmiFeatureContextId | null;
};

/**
 * Freundliche Produkterklärung statt einer stillen Sackgasse. Der Dialog löst
 * keine Bestellung aus und verweist bewusst nur auf die Plattformverwaltung.
 */
export function KlemmiUpgradeDialog({
  open,
  onOpenChange,
  currentPackageId,
  capability,
  contextId = null,
}: KlemmiUpgradeDialogProps) {
  const contextualCopy = contextId ? getKlemmiFeatureContext(contextId, currentPackageId) : null;
  const targetPackageId = capability
    ? requiredUpgradePackageForCapability(currentPackageId, capability)
    : null;
  const targetMeta = targetPackageId ? PRODUCT_PACKAGE_META[targetPackageId] : null;
  const featureLabel = contextualCopy?.title ?? (capability ? CAPABILITY_LABEL[capability] : "Diese Funktion");
  const benefits = targetPackageId ? UPGRADE_BENEFITS[targetPackageId] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="klemmi-upgrade-dialog"
        className="overflow-hidden bg-white p-0 text-slate-950 sm:max-w-xl"
      >
        <div className="relative border-b border-orange-100 bg-[radial-gradient(circle_at_12%_14%,rgba(255,237,213,0.95),transparent_44%),linear-gradient(135deg,#fff7ed,#eff6ff)] px-5 pb-5 pt-6 sm:px-6">
          <div className="pointer-events-none absolute -bottom-4 right-3 size-28 sm:right-6 sm:size-32" aria-hidden="true">
            <KlemmiMascot decorative />
          </div>
          <Badge variant="outline" className="border-orange-200 bg-white/80 text-orange-900">
            <LockKeyhole className="mr-1 size-3.5" aria-hidden="true" /> Paketgrenze
          </Badge>
          <DialogHeader className="mt-3 max-w-[calc(100%-5.5rem)] sm:max-w-[calc(100%-7rem)]">
            <DialogTitle className="text-xl leading-tight">Klemmi hat einen Hinweis</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-700">
              {contextualCopy ? (
                <>
                  <strong className="font-semibold text-slate-900">{contextualCopy.explanation}</strong>{" "}
                  Im Paket {PRODUCT_PACKAGE_META[currentPackageId].name} ist diese Funktion noch nicht enthalten. {contextualCopy.alternative}
                </>
              ) : (
                <>
                  <strong className="font-semibold text-slate-900">{featureLabel}</strong> ist im Paket {PRODUCT_PACKAGE_META[currentPackageId].name} nicht enthalten. Deine bisherigen Planungsdaten bleiben dabei selbstverständlich erhalten.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          {targetMeta ? (
            <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-blue-950">
                <Sparkles className="size-4 text-blue-700" aria-hidden="true" />
                Mit {targetMeta.name} geht es weiter
              </p>
              <p className="mt-1 text-sm text-blue-900">
                {targetMeta.shortDescription} <span className="font-medium">{targetMeta.priceLabel}</span>
              </p>
              <ul className="mt-3 space-y-2 text-sm text-blue-950">
                {benefits.map(benefit => (
                  <li key={benefit} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              Diese Funktion ist im aktuellen Produktumfang bereits verfügbar.
            </p>
          )}
          <p className="text-xs leading-5 text-slate-500">
            Es gibt keinen öffentlichen Checkout. Wenn ihr erweitern möchtet, stimmt die Plattformverwaltung die passende Freigabe mit euch ab.
          </p>
        </div>
        <DialogFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Verstanden, danke Klemmi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

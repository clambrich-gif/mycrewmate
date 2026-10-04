import { useAuth } from "@/_core/hooks/useAuth";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { KlemmiSurfaceGuide } from "@/components/KlemmiSurfaceGuide";
import { PageTitle } from "@/components/PageTitle";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CREATION_ACTION_BUTTON_CLASS } from "@/lib/creation-action";
import { CONTACTS_KLEMMI_STEPS } from "@/lib/klemmi-area-tours";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { trpc } from "@/lib/trpc";
import { Info, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

export default function Contacts() {
  const utils = trpc.useUtils();
  const { isTenantAdmin: canDelete, canWriteModule } = useTenantAdministration();
  const canManage = canWriteModule("contacts");
  const { data: contacts = [], isLoading } = trpc.contacts.list.useQuery();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sharePhoneInHelperPlan, setSharePhoneInHelperPlan] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSharePhoneInHelperPlan, setEditSharePhoneInHelperPlan] =
    useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [klemmiSuccessSignal, setKlemmiSuccessSignal] = useState<number | null>(null);
  const [klemmiGuideStartedEmpty, setKlemmiGuideStartedEmpty] = useState<boolean | null>(null);
  const klemmiGuideNeedsSample =
    klemmiGuideStartedEmpty ?? (!isLoading && contacts.length === 0);
  const contactGuideSteps = [
    ...CONTACTS_KLEMMI_STEPS.map(step =>
      step.key === "intro"
        ? {
            ...step,
            text: klemmiGuideNeedsSample
              ? "Hier ist noch kein Ansprechpartner vorhanden. Lege jetzt gemeinsam mit Klemmi eine echte Musterperson an; sie kann danach stehen bleiben oder wieder gelöscht werden."
              : "Ich zeige dir die vorhandenen Ansprechpartner und die sichtbaren Stammdatenfelder. Dafür wird nichts neu angelegt.",
          }
        : step.key === "save"
          ? {
              ...step,
              text: klemmiGuideNeedsSample
                ? "Klicke auf den markierten Button, damit die Musterperson wirklich angelegt wird. Danach zeige ich dir die Ansprechpartnerübersicht."
                : "Der markierte Button legt einen neuen Ansprechpartner an. Für diese Erklärung klickst du nicht darauf – gleich zeige ich dir die vorhandenen Stammdaten.",
              action: klemmiGuideNeedsSample ? undefined : "Übersicht zeigen",
              waitsForSuccess: klemmiGuideNeedsSample,
              completeOnSuccess: false,
              audioKey: klemmiGuideNeedsSample ? step.audioKey : "overview-save",
            }
          : step
    ),
    {
      key: "overview",
      selector: '[data-klemmi-target="contacts-overview"]',
      eyebrow: "Schritt 4 von 4",
      title: "Ansprechpartnerübersicht nutzen",
      text: klemmiGuideNeedsSample
        ? "Die Musterperson steht jetzt in der Liste. Passt sie zur Planung, lässt du sie stehen; sonst entfernst du sie über den roten Papierkorb."
        : "Hier sind die bereits angelegten Ansprechpartner. Über den Stift ergänzt du Stammdaten, über den roten Papierkorb entfernst du nur nicht mehr benötigte Personen.",
      audioKey: "complete",
      action: "Fertig",
    },
  ];

  const invalidate = () => {
    utils.contacts.list.invalidate();
    utils.planningTeamAccesses.list.invalidate();
    utils.planningTeamAccesses.availableContacts.invalidate();
    utils.auth.passwordStatus.invalidate();
    utils.helpers.list.invalidate();
    utils.plan.evaluate.invalidate();
    utils.dashboard.stats.invalidate();
    utils.pdf.settings.invalidate();
  };
  const create = trpc.contacts.create.useMutation({
    onSuccess: () => {
      invalidate();
      setName("");
      setEmail("");
      setPhone("");
      setSharePhoneInHelperPlan(false);
      setKlemmiSuccessSignal(Date.now());
      toast.success("Ansprechpartner angelegt");
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.contacts.remove.useMutation({
    onSuccess: result => {
      invalidate();
      setDeleteTarget(null);
      toast.success(
        result.deletedHelperId
          ? "Ansprechpartner und eigener Helfereintrag entfernt"
          : "Ansprechpartner entfernt"
      );
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.contacts.update.useMutation({
    onSuccess: () => {
      invalidate();
      setEditTarget(null);
      toast.success("Ansprechpartner aktualisiert");
    },
    onError: error => toast.error(error.message),
  });

  const addContact = () => {
    if (!name.trim() || create.isPending) return;
    create.mutate({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      sharePhoneInHelperPlan,
    });
  };
  const submitNewContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addContact();
  };
  const saveEdit = (contactId: number) => {
    if (!editName.trim() || update.isPending) return;
    update.mutate({
      id: contactId,
      name: editName.trim(),
      email: editEmail.trim() || null,
      phone: editPhone.trim() || null,
      sharePhoneInHelperPlan: editSharePhoneInHelperPlan,
    });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageTitle icon="contacts">Ansprechpartner</PageTitle>
          <p className="text-muted-foreground">
            Ansprechpartner werden hier als Stammdaten erfasst. Persönliche Planungsteam-Zugänge
            werden separat unter Schutz &amp; Protokoll angelegt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <KlemmiSurfaceGuide
            guideId="contacts"
            title="Ansprechpartner anlegen"
            introText="Ich zeige dir die echten Stammdatenfelder – vom Namen bis zur sicheren Anlage ohne versehentlichen Zugang."
            steps={contactGuideSteps}
            successSignal={klemmiSuccessSignal}
            completionAudioKey={klemmiGuideNeedsSample ? "complete" : "overview"}
            onOpenChange={open => {
              if (open) setKlemmiGuideStartedEmpty(!isLoading && contacts.length === 0);
              else setKlemmiGuideStartedEmpty(null);
            }}
          />
          <ResetAreaButton area="contacts" label="Ansprechpartner" />
        </div>
      </div>

      {canManage && (
        <Card className="border-blue-200 bg-slate-50/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-950">Neuanlage</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              data-klemmi-target="contacts-new"
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={submitNewContact}
            >
              <div data-klemmi-target="contacts-name" className="min-w-0 flex-1 sm:min-w-[280px]">
                <label
                  htmlFor="new-contact-name"
                  className="mb-1.5 block text-sm font-semibold text-slate-800"
                >
                  Name des Ansprechpartners
                </label>
                <Input
                  id="new-contact-name"
                  placeholder="Name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  className="h-11 border-slate-300 bg-white text-base shadow-sm placeholder:text-slate-600"
                />
              </div>
              <div data-klemmi-target="contacts-details" className="min-w-0 flex-1 sm:min-w-[240px]">
                <label
                  htmlFor="new-contact-email"
                  className="mb-1.5 block text-sm font-semibold text-slate-800"
                >
                  E-Mail-Adresse
                </label>
                <Input
                  id="new-contact-email"
                  type="email"
                  placeholder="beispiel@verein.de"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="h-11 border-slate-300 bg-white text-base shadow-sm placeholder:text-slate-600"
                />
              </div>
              <div data-klemmi-target="contacts-details" className="min-w-0 sm:w-56">
                <label
                  htmlFor="new-contact-phone"
                  className="mb-1.5 block text-sm font-semibold text-slate-800"
                >
                  Rufnummer
                </label>
                <Input
                  id="new-contact-phone"
                  type="tel"
                  placeholder="z. B. 0170 1234567"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  className="h-11 border-slate-300 bg-white text-base shadow-sm placeholder:text-slate-600"
                />
              </div>
              <div
                data-klemmi-target="contacts-phone-share"
                className="flex max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <Checkbox
                  id="new-contact-phone-share"
                  checked={sharePhoneInHelperPlan}
                  onCheckedChange={checked =>
                    setSharePhoneInHelperPlan(checked === true)
                  }
                  aria-label="Rufnummer in persönlichen Helfer-Einsatzplänen zeigen"
                />
                <label htmlFor="new-contact-phone-share" className="cursor-pointer font-semibold">
                  Rufnummer weitergeben
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      aria-label="Erklärung zur Rufnummernfreigabe anzeigen"
                    >
                      <Info className="size-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8} className="max-w-xs text-left text-xs leading-relaxed">
                    Die Rufnummer erscheint nur in den persönlichen Einsatzplänen von Helfern, die diesem Ansprechpartner zugeordnet sind. Ohne Häkchen bleibt sie intern.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button
                type="submit"
                data-klemmi-target="contacts-save"
                variant="outline"
                className={`h-11 shrink-0 px-5 ${CREATION_ACTION_BUTTON_CLASS}`}
                disabled={create.isPending || !name.trim()}
              >
                {create.isPending ? (
                  <Plus className="h-5 w-5 animate-pulse" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
                {create.isPending ? "Wird hinzugefügt …" : "Hinzufügen"}
              </Button>
            </form>
            <p className="mt-3 text-xs text-slate-600">
              Die Anlage erzeugt keinen Zugang und keine Zugangsdaten. Einen persönlichen Zugang
              können Sie bei Bedarf später unter Schutz &amp; Protokoll gezielt anlegen und verteilen.
            </p>
          </CardContent>
        </Card>
      )}

      <Card data-klemmi-target="contacts-overview" className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Liste ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Lade …</p>
          ) : (
            <ul className="divide-y">
              {contacts.map(contact => (
                <li
                  key={contact.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{contact.name}</div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {contact.phone || "Keine Rufnummer"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {contact.email || "Keine E-Mail hinterlegt"}
                      </span>
                    </div>
                  </div>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {canManage && <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Bearbeiten"
                      onClick={() => {
                        setEditTarget({ id: contact.id, name: contact.name });
                        setEditName(contact.name);
                        setEditEmail(contact.email ?? "");
                        setEditPhone(contact.phone ?? "");
                        setEditSharePhoneInHelperPlan(
                          Boolean(contact.sharePhoneInHelperPlan)
                        );
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>}
                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Löschen"
                        onClick={() =>
                          setDeleteTarget({
                            id: contact.id,
                            name: contact.name,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
              {contacts.length === 0 && (
                <li className="py-3 text-muted-foreground">
                  Noch keine Ansprechpartner angelegt.
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={open => {
          if (!open && !update.isPending) setEditTarget(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] bg-white sm:max-w-lg">
          <form
            className="space-y-5"
            onSubmit={event => {
              event.preventDefault();
              if (editTarget) saveEdit(editTarget.id);
            }}
          >
            <DialogHeader>
              <DialogTitle>
                Ansprechpartner bearbeiten – {editTarget?.name}
              </DialogTitle>
              <DialogDescription>
                Stammdaten des Ansprechpartners ändern. Persönliche Zugänge werden
                getrennt unter Schutz &amp; Protokoll verwaltet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label
                htmlFor="edit-contact-name"
                className="text-sm font-semibold text-slate-800"
              >
                Name des Ansprechpartners
              </label>
              <Input
                id="edit-contact-name"
                autoFocus
                value={editName}
                onChange={event => setEditName(event.target.value)}
                placeholder="Name des Ansprechpartners"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="edit-contact-email"
                className="text-sm font-semibold text-slate-800"
              >
                E-Mail-Adresse
              </label>
              <Input
                id="edit-contact-email"
                type="email"
                value={editEmail}
                onChange={event => setEditEmail(event.target.value)}
                placeholder="z. B. vorname.nachname@verein.de"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="edit-contact-phone"
                className="text-sm font-semibold text-slate-800"
              >
                Rufnummer
              </label>
              <Input
                id="edit-contact-phone"
                type="tel"
                value={editPhone}
                onChange={event => setEditPhone(event.target.value)}
                placeholder="z. B. 0170 1234567"
              />
            </div>
            <div
              data-klemmi-target="contacts-phone-share"
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
            >
              <Checkbox
                id="edit-contact-phone-share"
                checked={editSharePhoneInHelperPlan}
                onCheckedChange={checked =>
                  setEditSharePhoneInHelperPlan(checked === true)
                }
                aria-label="Rufnummer in persönlichen Helfer-Einsatzplänen zeigen"
              />
              <label htmlFor="edit-contact-phone-share" className="cursor-pointer font-semibold">
                Rufnummer weitergeben
              </label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    aria-label="Erklärung zur Rufnummernfreigabe anzeigen"
                  >
                    <Info className="size-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="max-w-xs text-left text-xs leading-relaxed">
                  Die Rufnummer erscheint nur in den persönlichen Einsatzplänen von Helfern, die diesem Ansprechpartner zugeordnet sind. Ohne Häkchen bleibt sie intern.
                </TooltipContent>
              </Tooltip>
            </div>
            <DialogFooter className="flex flex-row flex-nowrap items-center justify-between gap-3 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                disabled={update.isPending}
                onClick={() => setEditTarget(null)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={!editName.trim() || update.isPending}>
                {update.isPending ? "Wird gespeichert …" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AdminPasswordDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Ansprechpartner löschen?"
        description={`„${deleteTarget?.name ?? ""}“ und der gleichnamige eigene Helfereintrag werden gemeinsam gelöscht. Andere betreute Helfer bleiben erhalten und verlieren nur ihre Ansprechpartner-Zuordnung.`}
        confirmLabel="OK, löschen"
        busy={remove.isPending}
        onConfirm={adminPassword =>
          deleteTarget && remove.mutate({ id: deleteTarget.id, adminPassword })
        }
      />
    </div>
  );
}

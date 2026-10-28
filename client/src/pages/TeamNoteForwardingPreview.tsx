import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Channel = "email" | "whatsapp";
type PackageId = "event_pass" | "light" | "pro" | "enterprise";
type Role = "admin" | "co_admin" | "planner";
type NoteStatus = "available" | "expired";
type PreviewContact = {
  id: string;
  name: string;
  email: string | null;
  whatsappNumber: string | null;
};

const PACKAGE_OPTIONS: Array<{ value: PackageId; label: string }> = [
  { value: "event_pass", label: "Event Pass" },
  { value: "light", label: "Light" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "admin", label: "Administrator" },
  { value: "co_admin", label: "Co-Administrator" },
  { value: "planner", label: "Planungsteam" },
];

const PREVIEW_CONTACTS: PreviewContact[] = [
  {
    id: "anna-becker",
    name: "Anna Becker",
    email: "anna.becker@example.org",
    whatsappNumber: "+491701112233",
  },
  {
    id: "markus-weber",
    name: "Markus Weber",
    email: "markus.weber@example.org",
    whatsappNumber: "+491701112244",
  },
  {
    id: "sabine-roth",
    name: "Sabine Roth",
    email: "sabine.roth@example.org",
    whatsappNumber: "+491701112255",
  },
  {
    id: "leon-fischer",
    name: "Leon Fischer",
    email: "leon.fischer@example.org",
    whatsappNumber: null,
  },
  {
    id: "petra-schmitz",
    name: "Petra Schmitz",
    email: null,
    whatsappNumber: "+491701112266",
  },
  {
    id: "thomas-klein",
    name: "Thomas Klein",
    email: null,
    whatsappNumber: null,
  },
];

const PREVIEW_NOTE = {
  eventName: "Radsportfestival 2027",
  senderName: "Julia Neumann",
  senderRole: "Co-Administration",
  message:
    "Die Streckenfreigabe am Samstag verschiebt sich auf 07:30 Uhr. Bitte informiert eure Teams und seid bis 07:15 Uhr am Startbereich.",
} as const;

function channelLabel(channel: Channel) {
  return channel === "email" ? "E-Mail" : "WhatsApp";
}

function channelValue(contact: PreviewContact, channel: Channel) {
  return channel === "email" ? contact.email : contact.whatsappNumber;
}

function isForwardingAllowed(input: {
  packageId: PackageId;
  role: Role;
  noteStatus: NoteStatus;
}) {
  return (
    (input.packageId === "pro" || input.packageId === "enterprise") &&
    (input.role === "admin" || input.role === "co_admin") &&
    input.noteStatus === "available"
  );
}

function roleReason(input: {
  packageId: PackageId;
  role: Role;
  noteStatus: NoteStatus;
}) {
  if (input.noteStatus === "expired") {
    return "Die fiktive Notiz ist abgelaufen. In der echten App wäre keine Weitergabe mehr möglich.";
  }
  if (input.packageId === "event_pass" || input.packageId === "light") {
    return "Die Funktion wäre erst ab Pro verfügbar. In Event Pass und Light erscheint kein Weiterleitungsmenü.";
  }
  return "Nur Administratoren und Co-Administratoren könnten diese Notiz weitergeben.";
}

/**
 * Nicht veröffentlichte, datenfreie Staging-Vorschau. Die Seite verwendet
 * ausschließlich feste lokale Fakes und Simulationsmeldungen. Ergänzend
 * existiert ein serverseitig gesperrter Dry-run, aber diese Vorschau bindet
 * absichtlich weder Mail, WhatsApp noch Datenbank an.
 */
export default function TeamNoteForwardingPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("email");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recipientsConfirmed, setRecipientsConfirmed] = useState(false);
  const [openedChatIds, setOpenedChatIds] = useState<string[]>([]);
  const [channelChangeHint, setChannelChangeHint] = useState<string | null>(
    null
  );
  const [simulationMessage, setSimulationMessage] = useState<string | null>(
    null
  );
  const [packageId, setPackageId] = useState<PackageId>("pro");
  const [role, setRole] = useState<Role>("admin");
  const [noteStatus, setNoteStatus] = useState<NoteStatus>("available");

  const previewContext = { packageId, role, noteStatus };
  const forwardingAllowed = isForwardingAllowed(previewContext);
  const contacts = PREVIEW_CONTACTS;
  const note = PREVIEW_NOTE;

  const eligibleContacts = useMemo(
    () => contacts.filter(contact => Boolean(channelValue(contact, channel))),
    [channel, contacts]
  );
  const matchingContacts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("de-DE");
    if (!term) return contacts;
    return contacts.filter(contact =>
      contact.name.toLocaleLowerCase("de-DE").includes(term)
    );
  }, [contacts, search]);
  const selectedContacts = useMemo(
    () => contacts.filter(contact => selectedIds.includes(contact.id)),
    [contacts, selectedIds]
  );
  const selectedEligibleContacts = useMemo(
    () =>
      selectedContacts.filter(contact =>
        Boolean(channelValue(contact, channel))
      ),
    [channel, selectedContacts]
  );
  const uniqueSelectedContacts = useMemo(() => {
    const seen = new Set<string>();
    return selectedEligibleContacts.filter(contact => {
      const value = channelValue(contact, channel);
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }, [channel, selectedEligibleContacts]);
  const allEligibleSelected =
    eligibleContacts.length > 0 &&
    eligibleContacts.every(contact => selectedIds.includes(contact.id));
  const selectionLocked = channel === "whatsapp" && openedChatIds.length > 0;
  const nextWhatsAppRecipient = uniqueSelectedContacts.find(
    contact => !openedChatIds.includes(contact.id)
  );

  useEffect(() => {
    if (!forwardingAllowed) setDialogOpen(false);
  }, [forwardingAllowed]);

  const resetRecipientState = (hint: string | null = null) => {
    setSelectedIds([]);
    setRecipientsConfirmed(false);
    setOpenedChatIds([]);
    setSimulationMessage(null);
    setChannelChangeHint(hint);
  };

  const handleChannelChange = (nextChannel: Channel) => {
    if (nextChannel === channel) return;
    setChannel(nextChannel);
    resetRecipientState("Versandweg geändert – bitte Empfänger neu wählen.");
  };

  const toggleContact = (contact: PreviewContact) => {
    if (selectionLocked || !channelValue(contact, channel)) return;
    setSelectedIds(current => {
      const next = current.includes(contact.id)
        ? current.filter(id => id !== contact.id)
        : [...current, contact.id];
      return next;
    });
    setRecipientsConfirmed(false);
    setSimulationMessage(null);
  };

  const toggleAllEligible = () => {
    if (selectionLocked) return;
    setSelectedIds(
      allEligibleSelected ? [] : eligibleContacts.map(contact => contact.id)
    );
    setRecipientsConfirmed(false);
    setSimulationMessage(null);
  };

  const handleEmailSimulation = () => {
    if (!recipientsConfirmed || selectedEligibleContacts.length === 0) return;
    setSimulationMessage(
      `Simulation: Versandauftrag für ${selectedEligibleContacts.length} Ansprechpartner angenommen. Es wurde keine E-Mail versendet.`
    );
  };

  const handleWhatsAppSimulation = () => {
    if (!nextWhatsAppRecipient) return;
    setOpenedChatIds(current => [...current, nextWhatsAppRecipient.id]);
    setSimulationMessage(
      `Simulation: WhatsApp für ${nextWhatsAppRecipient.name} wurde vorbereitet. Es wurde weder ein Chat geöffnet noch eine Nachricht versendet.`
    );
  };

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_right,_#dbeafe,_transparent_34%),linear-gradient(180deg,_#f8fafc,_#eef6ff)] p-4 text-slate-950 sm:p-8">
      <section className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">
              Sandbox-Vorschau · kein Versand · keine Echtdaten
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Team-Notiz an Ansprechpartner weitergeben
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              Die Vorschau bildet den freigegebenen Ein-Dialog-Ablauf ab. Die
              Abschlussaktionen sind harmlose Sandbox-Simulationen: Sie senden
              keine E-Mail, öffnen kein WhatsApp und schreiben keine Daten.
            </p>
          </div>
          <Badge className="w-fit border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-800">
            Entwurf · ab Pro
          </Badge>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1.1fr_1.9fr] md:p-5">
          <div>
            <p className="text-xs font-bold tracking-wide text-blue-700 uppercase">
              Prüffall steuern
            </p>
            <h2 className="mt-1 text-lg font-bold">
              Paket, Rolle und Notizstatus
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Diese Schalter existieren nur hier, damit die Sperren ohne echte
              Vereinsdaten geprüft werden können.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-800">
              Paket
              <select
                value={packageId}
                onChange={event => {
                  setPackageId(event.target.value as PackageId);
                  resetRecipientState();
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {PACKAGE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-800">
              Rolle
              <select
                value={role}
                onChange={event => {
                  setRole(event.target.value as Role);
                  resetRecipientState();
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {ROLE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-800">
              Notizstatus
              <select
                value={noteStatus}
                onChange={event => {
                  setNoteStatus(event.target.value as NoteStatus);
                  resetRecipientState();
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="available">Verfügbar (unter 24 Stunden)</option>
                <option value="expired">Abgelaufen (über 24 Stunden)</option>
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold">Team-Notizen</h2>
                <p className="truncate text-xs text-slate-500">
                  Live-Chat · {note.eventName} · 24h Speicher
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-slate-300 bg-white text-slate-600"
            >
              Fiktive Ansicht
            </Badge>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="max-w-2xl rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 p-4 shadow-xs">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-900">
                    {note.senderName}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700"
                  >
                    {note.senderRole}
                  </Badge>
                  <span className="text-slate-500">10:12 Uhr</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Aktionen für diese Team-Notiz"
                      title="Aktionen für diese Team-Notiz"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-60">
                    <DropdownMenuItem
                      onSelect={() =>
                        setSimulationMessage(
                          "Notiz kopieren ist in der Sandbox nicht verbunden."
                        )
                      }
                    >
                      <UserRound /> Notiz kopieren
                    </DropdownMenuItem>
                    {forwardingAllowed && (
                      <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
                        <Send className="text-blue-700" /> Ansprechpartner
                        informieren
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {note.message}
              </p>
            </div>
            {forwardingAllowed ? (
              <p className="text-sm text-slate-600">
                Öffne das Drei-Punkte-Menü an der Notiz und wähle{" "}
                <strong>Ansprechpartner informieren</strong>.
              </p>
            ) : (
              <Alert className="border-slate-200 bg-slate-50 text-slate-800">
                <ShieldCheck />
                <AlertTitle>Weiterleitungsaktion ausgeblendet</AlertTitle>
                <AlertDescription>
                  {roleReason(previewContext)}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </section>
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={open => {
          setDialogOpen(open);
          if (!open) resetRecipientState();
        }}
      >
        <DialogContent className="max-w-[calc(100%-1rem)] gap-0 overflow-hidden border-slate-200 p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-slate-200 bg-white px-5 pt-5 pb-4 text-left sm:px-6 sm:pt-6">
            <DialogTitle className="text-2xl tracking-tight">
              Ansprechpartner informieren
            </DialogTitle>
            <DialogDescription className="text-left text-base text-slate-600">
              {note.eventName} · Team-Notiz von {note.senderName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 bg-slate-50/70 p-4 sm:p-6">
            <Tabs
              value={channel}
              onValueChange={value => handleChannelChange(value as Channel)}
            >
              <TabsList className="grid h-11 w-full grid-cols-2 bg-slate-200/80 p-1">
                <TabsTrigger
                  value="email"
                  className="gap-2 text-base data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  <Mail /> E-Mail
                </TabsTrigger>
                <TabsTrigger
                  value="whatsapp"
                  className="gap-2 text-base data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  <MessageCircle /> WhatsApp
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {channelChangeHint && (
              <Alert className="border-blue-200 bg-blue-50 text-blue-950">
                <Info className="text-blue-700" />
                <AlertDescription className="text-blue-900">
                  {channelChangeHint}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.25fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Empfänger wählen</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Nur fiktive Ansprechpartner. Helfer werden nicht
                      einbezogen.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-slate-300 bg-slate-50 text-slate-600"
                  >
                    {eligibleContacts.length} mit {channelLabel(channel)}
                  </Badge>
                </div>

                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Name suchen …"
                    className="pl-9"
                    aria-label="Ansprechpartner nach Name suchen"
                  />
                </div>

                <button
                  type="button"
                  onClick={toggleAllEligible}
                  disabled={selectionLocked || eligibleContacts.length === 0}
                  className="mt-3 flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Checkbox
                    checked={
                      allEligibleSelected
                        ? true
                        : selectedEligibleContacts.length > 0
                          ? "indeterminate"
                          : false
                    }
                    aria-label={`Alle Ansprechpartner mit ${channel === "email" ? "E-Mail" : "WhatsApp-Nummer"} auswählen`}
                    tabIndex={-1}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      Alle Ansprechpartner mit{" "}
                      {channel === "email" ? "E-Mail" : "WhatsApp-Nummer"}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Alle passenden Kontakte, auch außerhalb der Suche.
                    </span>
                  </span>
                </button>

                <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {matchingContacts.map(contact => {
                    const available = Boolean(channelValue(contact, channel));
                    const selected = selectedIds.includes(contact.id);
                    const reason =
                      channel === "email"
                        ? "Keine E-Mail-Adresse"
                        : "Keine WhatsApp-Nummer";
                    return (
                      <button
                        type="button"
                        key={contact.id}
                        disabled={!available || selectionLocked}
                        onClick={() => toggleContact(contact)}
                        className={cn(
                          "flex w-full items-center gap-3 p-3 text-left transition-colors",
                          available && !selectionLocked
                            ? "hover:bg-slate-50"
                            : "cursor-not-allowed opacity-55"
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          disabled={!available || selectionLocked}
                          tabIndex={-1}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-slate-900">
                            {contact.name}
                          </span>
                          {!available && (
                            <span className="block text-xs text-slate-500">
                              {reason}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1">
                          {contact.email ? (
                            <Badge
                              variant="outline"
                              className="border-blue-100 bg-blue-50 text-blue-700"
                            >
                              <Mail /> E-Mail
                            </Badge>
                          ) : null}
                          {contact.whatsappNumber ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-100 bg-emerald-50 text-emerald-700"
                            >
                              <MessageCircle /> WhatsApp
                            </Badge>
                          ) : null}
                          {!contact.email && !contact.whatsappNumber ? (
                            <span className="text-xs text-slate-500">
                              Kein Kontaktweg
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 text-sm">
                  <strong>{selectedEligibleContacts.length} ausgewählt</strong>
                  <span className="text-slate-500">
                    {" "}
                    · {eligibleContacts.length} mit {channelLabel(channel)}
                  </span>
                  {selectionLocked && (
                    <p className="mt-1 text-xs text-blue-700">
                      Die Auswahl ist nach der ersten simulierten Chatöffnung
                      für diesen Durchgang fest.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                {channel === "email" ? (
                  <>
                    <h3 className="text-lg font-bold">E-Mail-Vorschau</h3>
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                      <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-[4.5rem_1fr]">
                        <dt className="font-semibold text-slate-600">Von:</dt>
                        <dd>
                          <strong>MyCrewMate</strong>
                          <br />
                          <span className="text-slate-600">
                            info@mycrewmate.de · Sandbox-Absender
                          </span>
                        </dd>
                        <dt className="font-semibold text-slate-600">An:</dt>
                        <dd className="flex flex-wrap gap-1.5">
                          {selectedEligibleContacts.length === 0 ? (
                            <span className="text-slate-500">
                              Noch keine Ansprechpartner ausgewählt
                            </span>
                          ) : (
                            selectedEligibleContacts.map(contact => (
                              <Badge
                                key={contact.id}
                                className="border border-blue-100 bg-blue-50 px-2 py-1 text-blue-950"
                              >
                                {contact.name} &lt;{contact.email}&gt;
                              </Badge>
                            ))
                          )}
                        </dd>
                        <dt className="font-semibold text-slate-600">
                          Betreff:
                        </dt>
                        <dd className="font-semibold">
                          [{note.eventName}] Aktuelle Team-Notiz
                        </dd>
                      </dl>
                      <div className="mt-4 border-t border-slate-200 pt-4 whitespace-pre-wrap leading-6 text-slate-800">
                        {"Hallo zusammen,\n\n"}
                        {note.message}
                        {"\n\n"}
                        {note.senderName}
                        {" · "}
                        {note.eventName}
                      </div>
                    </div>

                    <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-950">
                      <AlertTriangle className="text-amber-700" />
                      <AlertDescription className="text-amber-900">
                        Eine gemeinsame Vereins-E-Mail. Alle Adressen sind im
                        Feld „An:“ füreinander sichtbar. Kein BCC.
                        {selectedEligibleContacts.length > 0 && (
                          <span className="block pt-1 font-semibold">
                            {selectedEligibleContacts.length} Ansprechpartner ·{" "}
                            {uniqueSelectedContacts.length} eindeutige
                            E-Mail-Adressen
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>

                    <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm font-medium text-slate-800">
                      <Checkbox
                        checked={recipientsConfirmed}
                        disabled={selectedEligibleContacts.length === 0}
                        onCheckedChange={checked =>
                          setRecipientsConfirmed(checked === true)
                        }
                      />
                      <span>Ich bestätige die sichtbare Empfängerliste.</span>
                    </label>
                  </>
                ) : (
                  <>
                    <Alert className="border-blue-200 bg-blue-50 text-blue-950">
                      <Info className="text-blue-700" />
                      <AlertTitle>
                        {uniqueSelectedContacts.length} einzelne WhatsApp-Chats
                      </AlertTitle>
                      <AlertDescription className="text-blue-900">
                        Du öffnest jeden Chat einzeln. In WhatsApp würdest du
                        selbst auf Senden drücken. Kein automatischer Versand.
                      </AlertDescription>
                    </Alert>
                    <h3 className="mt-4 text-lg font-bold">
                      Nachrichtenvorschau
                    </h3>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                      <strong>
                        {note.eventName} – Hinweis von {note.senderName}:
                      </strong>
                      {"\n\n"}
                      {note.message}
                    </div>
                    <div className="mt-4">
                      <p className="font-semibold">
                        {openedChatIds.length} von{" "}
                        {uniqueSelectedContacts.length} Chatöffnungen simuliert
                      </p>
                      <div className="mt-2 space-y-2">
                        {uniqueSelectedContacts.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            Wähle mindestens einen Ansprechpartner mit
                            WhatsApp-Nummer.
                          </p>
                        ) : (
                          uniqueSelectedContacts.map(contact => {
                            const opened = openedChatIds.includes(contact.id);
                            const isNext =
                              nextWhatsAppRecipient?.id === contact.id;
                            return (
                              <div
                                key={contact.id}
                                className={cn(
                                  "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                                  isNext
                                    ? "border-blue-200 bg-blue-50"
                                    : "border-slate-200 bg-white"
                                )}
                              >
                                <span className="flex items-center gap-2 font-semibold">
                                  <span className="flex size-7 items-center justify-center rounded-full bg-slate-100">
                                    <UserRound className="size-4 text-slate-500" />
                                  </span>
                                  {contact.name}
                                </span>
                                <span
                                  className={
                                    opened
                                      ? "text-emerald-700"
                                      : isNext
                                        ? "text-blue-700"
                                        : "text-slate-500"
                                  }
                                >
                                  {opened
                                    ? "Simuliert"
                                    : isNext
                                      ? "Als Nächstes"
                                      : "Noch nicht simuliert"}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Eine Chatöffnung ist keine Versandbestätigung.
                      </p>
                    </div>
                  </>
                )}
              </section>
            </div>

            {simulationMessage && (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
                <CheckCircle2 className="text-emerald-700" />
                <AlertTitle>Nur Simulation</AlertTitle>
                <AlertDescription className="text-emerald-900">
                  {simulationMessage}
                </AlertDescription>
              </Alert>
            )}

            <Alert className="border-slate-200 bg-slate-50 text-slate-700">
              <ShieldCheck className="text-slate-600" />
              <AlertDescription>
                Extern geteilte Inhalte werden nicht mit dem 24-Stunden-Chat
                gelöscht. Diese Sandbox teilt jedoch nichts extern.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {channel === "email" ? "Abbrechen" : "Schließen"}
            </Button>
            {channel === "email" ? (
              <div className="space-y-1 text-right">
                <Button
                  onClick={handleEmailSimulation}
                  disabled={
                    selectedEligibleContacts.length === 0 ||
                    !recipientsConfirmed
                  }
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
                >
                  <Mail /> E-Mail an {selectedEligibleContacts.length || "…"}{" "}
                  Ansprechpartner simulieren
                </Button>
                <p className="text-xs text-slate-500">
                  Dieser Klick löst nur eine lokale Sandbox-Simulation aus.
                </p>
              </div>
            ) : (
              <div className="space-y-1 text-right">
                <Button
                  onClick={handleWhatsAppSimulation}
                  disabled={!nextWhatsAppRecipient}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
                >
                  <ExternalLink />
                  {nextWhatsAppRecipient
                    ? `WhatsApp für ${nextWhatsAppRecipient.name.split(" ")[0]} simulieren`
                    : "WhatsApp-Auswahl prüfen"}
                </Button>
                <p className="text-xs text-slate-500">
                  Öffnet keinen Chat und bereitet keine Nachricht außerhalb der
                  Sandbox vor.
                </p>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

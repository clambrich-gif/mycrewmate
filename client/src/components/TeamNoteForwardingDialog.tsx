import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { buildWhatsAppShareUrl } from "@/lib/whatsappShare";
import { trpc } from "@/lib/trpc";
import type { TeamNoteItem } from "@/components/LiveChatWidget";
import {
  Check,
  CheckCheck,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Search,
  Send,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ForwardingChannel = "email" | "whatsapp";

type EmailResult = {
  status:
    | "accepted"
    | "not_configured"
    | "rejected"
    | "unknown"
    | "already_started";
  recipientCount: number;
  addressCount: number;
};

type WhatsAppContactStatus = "opened" | "sent";

function noteRoleLabel(role: "user" | "admin") {
  return role === "admin" ? "Administration" : "Planungsteam";
}

export function TeamNoteForwardingDialog({
  note,
  open,
  onOpenChange,
}: {
  note: TeamNoteItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [channel, setChannel] = useState<ForwardingChannel>("email");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [channelChangedNotice, setChannelChangedNotice] = useState(false);
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null);
  const [whatsAppContactStatuses, setWhatsAppContactStatuses] = useState<
    Record<number, WhatsAppContactStatus>
  >({});

  const queryInput = useMemo(() => ({ noteId: note?.id ?? 0 }), [note?.id]);
  const recipientsQuery = trpc.notes.forwardingRecipients.useQuery(queryInput, {
    enabled: Boolean(note && open),
    retry: false,
  });
  const emailMutation = trpc.notes.forwardEmail.useMutation({
    onSuccess: result => {
      setEmailResult(result);
      if (result.status === "accepted") {
        toast.success("E-Mail-Auftrag wurde vom Mailserver angenommen.");
      }
    },
    onError: error =>
      toast.error(
        error.message || "E-Mail-Auftrag konnte nicht gestartet werden."
      ),
  });
  const whatsAppMutation = trpc.notes.prepareWhatsApp.useMutation();

  const contacts = recipientsQuery.data?.contacts ?? [];
  const serverNote = recipientsQuery.data?.note;
  const eligibleContacts = useMemo(
    () =>
      contacts.filter(contact =>
        channel === "email" ? Boolean(contact.email) : Boolean(contact.whatsApp)
      ),
    [channel, contacts]
  );
  const filteredContacts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("de-DE");
    if (!needle) return contacts;
    return contacts.filter(contact =>
      contact.name.toLocaleLowerCase("de-DE").includes(needle)
    );
  }, [contacts, search]);
  const selectedContacts = useMemo(
    () => contacts.filter(contact => selectedIds.includes(contact.id)),
    [contacts, selectedIds]
  );
  const selectedEligibleContacts = useMemo(
    () =>
      selectedContacts.filter(contact =>
        channel === "email" ? Boolean(contact.email) : Boolean(contact.whatsApp)
      ),
    [channel, selectedContacts]
  );
  const uniqueDestinationCount = useMemo(() => {
    const values = new Set(
      selectedEligibleContacts
        .map(contact =>
          channel === "email" ? contact.email : contact.whatsApp
        )
        .filter((value): value is string => Boolean(value))
    );
    return values.size;
  }, [channel, selectedEligibleContacts]);
  const duplicateCount = Math.max(
    0,
    selectedEligibleContacts.length - uniqueDestinationCount
  );
  const whatsAppOpenedCount = selectedEligibleContacts.filter(contact =>
    Boolean(whatsAppContactStatuses[contact.id])
  ).length;
  const whatsAppSentCount = selectedEligibleContacts.filter(
    contact => whatsAppContactStatuses[contact.id] === "sent"
  ).length;

  useEffect(() => {
    if (!note?.id) return;
    setChannel("email");
    setSearch("");
    setSelectedIds([]);
    setChannelChangedNotice(false);
    setEmailResult(null);
    setWhatsAppContactStatuses({});
  }, [note?.id]);

  useEffect(() => {
    setEmailResult(null);
    setWhatsAppContactStatuses(
      current =>
        Object.fromEntries(
          Object.entries(current).filter(([contactId]) =>
            selectedIds.includes(Number(contactId))
          )
        ) as Record<number, WhatsAppContactStatus>
    );
  }, [selectedIds]);

  const close = () => onOpenChange(false);
  const changeChannel = (nextChannel: string) => {
    if (nextChannel !== "email" && nextChannel !== "whatsapp") return;
    if (nextChannel === channel) return;
    setChannel(nextChannel);
    setSelectedIds([]);
    setEmailResult(null);
    setWhatsAppContactStatuses({});
    setChannelChangedNotice(true);
  };
  const toggleContact = (contactId: number) => {
    setSelectedIds(current =>
      current.includes(contactId)
        ? current.filter(id => id !== contactId)
        : [...current, contactId]
    );
  };
  const selectAllEligible = () => {
    setSelectedIds(eligibleContacts.map(contact => contact.id));
  };
  const clearSelection = () => setSelectedIds([]);
  const prepareWhatsApp = (
    contact: (typeof selectedEligibleContacts)[number]
  ) => {
    if (!note || !contact.whatsApp || whatsAppMutation.isPending) return;
    // Das leere Fenster entsteht direkt durch den Nutzerklick. Nach der
    // serverseitigen Freigabe wird nur seine URL ersetzt – popupblocker-sicher.
    const chatWindow = window.open("about:blank", "_blank");
    if (!chatWindow) {
      toast.error(
        "Der Browser hat das WhatsApp-Fenster blockiert. Bitte Pop-ups für MyCrewMate erlauben."
      );
      return;
    }
    whatsAppMutation.mutate(
      { noteId: note.id, contactId: contact.id },
      {
        onSuccess: result => {
          const url = buildWhatsAppShareUrl(
            result.message,
            result.recipient.phone
          );
          if (chatWindow.closed) {
            toast.error(
              "Das WhatsApp-Fenster wurde geschlossen. Bitte den Kontakt erneut öffnen."
            );
            return;
          }
          // Das Fenster wird ohne noopener geöffnet, damit die nach der
          // Serverprüfung nötige Weiterleitung zuverlässig funktioniert.
          // Vor dem Verlassen der neutralen Leerseite lösen wir die Verbindung
          // zur App wieder, damit WhatsApp keinen Zugriff auf MyCrewMate erhält.
          chatWindow.opener = null;
          chatWindow.location.replace(url);
          setWhatsAppContactStatuses(current => ({
            ...current,
            [result.recipient.id]:
              current[result.recipient.id] === "sent" ? "sent" : "opened",
          }));
          toast.success(
            `WhatsApp für ${result.recipient.name} wurde vorbereitet.`
          );
        },
        onError: error => {
          chatWindow.close();
          toast.error(
            error.message || "WhatsApp konnte nicht vorbereitet werden."
          );
        },
      }
    );
  };

  const setWhatsAppSent = (contactId: number, sent: boolean) => {
    setWhatsAppContactStatuses(current => {
      const next = { ...current };
      if (sent) {
        next[contactId] = "sent";
      } else if (next[contactId] === "sent") {
        next[contactId] = "opened";
      }
      return next;
    });
  };

  const sendEmail = () => {
    if (!note || selectedEligibleContacts.length === 0) return;
    emailMutation.mutate({
      noteId: note.id,
      contactIds: selectedEligibleContacts.map(contact => contact.id),
    });
  };

  const canSendEmail =
    selectedEligibleContacts.length > 0 &&
    recipientsQuery.data?.emailDeliveryConfigured === true &&
    !emailMutation.isPending &&
    emailResult?.status !== "accepted" &&
    emailResult?.status !== "already_started";

  const emailSendLabel = emailMutation.isPending
    ? "E-Mail wird gesendet …"
    : emailResult?.status === "accepted" ||
        emailResult?.status === "already_started"
      ? "E-Mail-Auftrag bereits ausgelöst"
      : `E-Mail an ${selectedEligibleContacts.length} Ansprechpartner senden`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-y-auto border-slate-200 bg-white p-0 text-slate-950 sm:max-w-5xl"
      >
        <DialogHeader className="border-b border-slate-200 px-5 py-4 text-left sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
              <Send className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate pr-8">
                Ansprechpartner informieren
              </DialogTitle>
              <DialogDescription className="mt-1 pr-6 text-xs leading-5 text-slate-600">
                Diese einzelne Team-Notiz wird bewusst an ausgewählte
                Ansprechpartner weitergegeben.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4 sm:px-6">
          <Tabs value={channel} onValueChange={changeChannel}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 sm:w-[330px]">
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" /> E-Mail
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {channelChangedNotice && (
            <div
              role="status"
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
            >
              Versandweg geändert – bitte Empfänger neu wählen.
            </div>
          )}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            <strong>Wichtig:</strong> Weitergeleitete E-Mails und vorbereitete
            WhatsApp-Texte werden nicht gemeinsam mit dem internen
            24-Stunden-Chat gelöscht.
          </div>

          {recipientsQuery.isPending && (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Ansprechpartner
              werden geprüft …
            </div>
          )}
          {recipientsQuery.isError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
            >
              {recipientsQuery.error.message ||
                "Die Weitergabe ist für diese Notiz nicht mehr verfügbar."}
            </div>
          )}

          {serverNote && !recipientsQuery.isError && (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.25fr]">
              <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Empfänger wählen
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Nur Ansprechpartner dieser Veranstaltung
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-white text-blue-800"
                  >
                    {selectedEligibleContacts.length} ausgewählt
                  </Badge>
                </div>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Ansprechpartner suchen …"
                    className="h-10 bg-white pl-9"
                  />
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllEligible}
                    disabled={eligibleContacts.length === 0}
                  >
                    <Users className="mr-1.5 h-3.5 w-3.5" />
                    Alle mit {channel === "email" ? "E-Mail" : "WhatsApp"}
                  </Button>
                  {selectedIds.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                    >
                      Auswahl leeren
                    </Button>
                  )}
                </div>
                <div className="max-h-[36dvh] space-y-1.5 overflow-y-auto pr-1 lg:max-h-[420px]">
                  {filteredContacts.map(contact => {
                    const reachable =
                      channel === "email"
                        ? Boolean(contact.email)
                        : Boolean(contact.whatsApp);
                    const isChecked = selectedIds.includes(contact.id);
                    const duplicate =
                      channel === "email"
                        ? contact.emailDuplicate
                        : contact.whatsAppDuplicate;
                    return (
                      <label
                        key={contact.id}
                        className={cn(
                          "flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors",
                          reachable
                            ? isChecked
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                            : "cursor-not-allowed border-slate-200 bg-slate-100/70 text-slate-500"
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={!reachable}
                          onCheckedChange={() =>
                            reachable && toggleContact(contact.id)
                          }
                          className="mt-0.5"
                          aria-label={`${contact.name} auswählen`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {contact.name}
                          </span>
                          {channel === "email" ? (
                            contact.email ? (
                              <span className="block truncate text-xs text-slate-600">
                                {contact.email}
                              </span>
                            ) : (
                              <span className="block text-xs text-slate-500">
                                Keine gültige E-Mail-Adresse hinterlegt
                              </span>
                            )
                          ) : contact.whatsApp ? (
                            <span className="block text-xs text-slate-600">
                              WhatsApp-Nummer verfügbar
                            </span>
                          ) : (
                            <span className="block text-xs text-slate-500">
                              Keine gültige WhatsApp-Nummer hinterlegt
                            </span>
                          )}
                          {reachable && duplicate && (
                            <span className="mt-1 block text-[11px] text-amber-700">
                              Doppelter Kontaktweg – wird nur einmal verwendet.
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                  {filteredContacts.length === 0 && (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">
                      Kein Ansprechpartner gefunden.
                    </p>
                  )}
                </div>
              </section>

              <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <h3 className="text-sm font-bold text-slate-900">
                  {channel === "email"
                    ? "E-Mail-Vorschau"
                    : "WhatsApp-Schritte"}
                </h3>
                <div className="mt-3 flex flex-1 flex-col gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                    <p>
                      <strong>Veranstaltung:</strong> {serverNote.eventName}
                    </p>
                    <p>
                      <strong>Von:</strong> {serverNote.senderName} (
                      {noteRoleLabel(serverNote.senderRole)})
                    </p>
                    <p className="mt-2 whitespace-pre-wrap border-l-2 border-blue-500 pl-3 text-sm text-slate-900">
                      {serverNote.message}
                    </p>
                  </div>

                  {channel === "email" ? (
                    <>
                      <div className="rounded-lg border border-slate-200 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Sichtbare An:-Liste
                        </p>
                        {selectedEligibleContacts.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Bitte mindestens einen Ansprechpartner auswählen.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-1 text-sm text-slate-800">
                            {selectedEligibleContacts.map(contact => (
                              <li
                                key={contact.id}
                                className="flex items-start gap-2"
                              >
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{" "}
                                <span>
                                  {contact.name} · {contact.email}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {duplicateCount > 0 && (
                          <p className="mt-2 text-xs leading-5 text-amber-800">
                            {duplicateCount} doppelter Kontaktweg wird nicht ein
                            zweites Mal angeschrieben.
                          </p>
                        )}
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-950">
                        <p>
                          <strong>Betreff:</strong> [{serverNote.eventName}]
                          Aktuelle Team-Notiz
                        </p>
                        <p className="mt-1">
                          Die ausgewählten Ansprechpartner sehen sich
                          gegenseitig in der An:-Liste. Der Absender ist die
                          bestehende MyCrewMate-Vereinsadresse.
                        </p>
                      </div>
                      {!recipientsQuery.data?.emailDeliveryConfigured && (
                        <div
                          role="alert"
                          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950"
                        >
                          E-Mail-Versand ist derzeit nicht konfiguriert. Es wird
                          kein Versandauftrag ausgelöst.
                        </div>
                      )}
                      {emailResult && (
                        <div
                          className={cn(
                            "rounded-lg border p-3 text-sm leading-5",
                            emailResult.status === "accepted"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                              : "border-amber-300 bg-amber-50 text-amber-950"
                          )}
                        >
                          {emailResult.status === "accepted" &&
                            `Der Mailserver hat den Auftrag für ${emailResult.addressCount} E-Mail-Adresse${emailResult.addressCount === 1 ? "" : "n"} angenommen.`}
                          {emailResult.status === "not_configured" &&
                            "Der Versand wurde nicht ausgeführt, weil der Mailserver nicht konfiguriert ist."}
                          {emailResult.status === "rejected" &&
                            "Der Mailserver hat den Auftrag nicht angenommen. Der Versand wurde nicht automatisch wiederholt."}
                          {emailResult.status === "unknown" &&
                            "Das Ergebnis des Mail-Auftrags ist unklar. Er wurde nicht automatisch wiederholt."}
                          {emailResult.status === "already_started" &&
                            "Für diese Team-Notiz wurde bereits ein E-Mail-Auftrag vorgemerkt. Er wird nicht doppelt ausgelöst."}
                        </div>
                      )}
                      <Button
                        type="button"
                        size="lg"
                        className={cn(
                          "mt-auto min-h-24 w-full rounded-xl border px-6 text-base font-bold shadow-none transition-all disabled:opacity-100",
                          canSendEmail
                            ? "border-slate-700 bg-slate-700 text-white shadow-sm hover:bg-slate-800 active:scale-[0.98]"
                            : "border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-100"
                        )}
                        disabled={!canSendEmail}
                        onClick={sendEmail}
                      >
                        {emailMutation.isPending ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <Mail className="h-6 w-6" />
                        )}
                        {emailSendLabel}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-950">
                        WhatsApp öffnet jeweils einen einzelnen Chat mit
                        vorbereitetem Text. Die Nachricht wird erst von Ihnen in
                        WhatsApp selbst gesendet.
                      </div>
                      {selectedEligibleContacts.length === 0 ? (
                        <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                          Bitte mindestens einen Ansprechpartner mit
                          WhatsApp-Nummer auswählen.
                        </p>
                      ) : (
                        <div className="rounded-lg border border-slate-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Ausgewählte Ansprechpartner
                              </p>
                              <p className="mt-0.5 text-xs text-slate-600">
                                {whatsAppSentCount} von{" "}
                                {selectedEligibleContacts.length} als versendet
                                markiert · {whatsAppOpenedCount} Chat
                                {whatsAppOpenedCount === 1 ? "" : "s"} geöffnet
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {whatsAppSentCount ===
                              selectedEligibleContacts.length
                                ? "Abgeschlossen"
                                : "In Bearbeitung"}
                            </Badge>
                          </div>
                          <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                            Nach dem Abschicken in WhatsApp setzen Sie das
                            Häkchen <strong>Versendet</strong>. MyCrewMate kann
                            das Öffnen eines Chats erkennen, den tatsächlichen
                            Versand aber nicht selbst prüfen.
                          </p>
                          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                            {selectedEligibleContacts.map(contact => {
                              const status =
                                whatsAppContactStatuses[contact.id];
                              const hasOpenedChat = Boolean(status);
                              const isSent = status === "sent";

                              return (
                                <li
                                  key={contact.id}
                                  className="rounded-lg border border-slate-200 bg-white p-3"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-900">
                                        {contact.name}
                                      </p>
                                      <p
                                        className={cn(
                                          "mt-1 flex items-center gap-1.5 text-xs font-medium",
                                          isSent
                                            ? "text-emerald-700"
                                            : hasOpenedChat
                                              ? "text-amber-700"
                                              : "text-slate-500"
                                        )}
                                      >
                                        {isSent ? (
                                          <CheckCheck className="h-3.5 w-3.5" />
                                        ) : hasOpenedChat ? (
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        ) : (
                                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                        )}
                                        {isSent
                                          ? "Versendet"
                                          : hasOpenedChat
                                            ? "Chat geöffnet – Versand bestätigen"
                                            : "Noch offen"}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={whatsAppMutation.isPending}
                                        onClick={() => prepareWhatsApp(contact)}
                                      >
                                        {whatsAppMutation.isPending ? (
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                          <ExternalLink className="mr-2 h-4 w-4" />
                                        )}
                                        WhatsApp für {contact.name} öffnen
                                      </Button>
                                      <Label
                                        htmlFor={`whatsapp-sent-${contact.id}`}
                                        className={cn(
                                          "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium",
                                          isSent
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                            : hasOpenedChat
                                              ? "border-slate-200 bg-white text-slate-700"
                                              : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                                        )}
                                      >
                                        <Checkbox
                                          id={`whatsapp-sent-${contact.id}`}
                                          checked={isSent}
                                          disabled={!hasOpenedChat}
                                          onCheckedChange={checked =>
                                            setWhatsAppSent(
                                              contact.id,
                                              checked === true
                                            )
                                          }
                                        />
                                        Versendet
                                      </Label>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          {duplicateCount > 0 && (
                            <p className="mt-3 text-xs leading-5 text-amber-800">
                              {duplicateCount} doppelter WhatsApp-Kontaktweg
                              kann bei Bedarf nur einmal geöffnet werden.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={close}>
            {channel === "email" ? "Abbrechen" : "Fertig"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

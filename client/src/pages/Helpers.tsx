import { useAuth } from "@/_core/hooks/useAuth";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBase64File, safeDownloadName } from "@/lib/download";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { FileDown, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ResetAreaButton } from "@/components/ResetAreaButton";

const YN = [
  { v: "ja", l: "Ja" },
  { v: "nein", l: "Nein" },
] as const;
const YNV = [
  { v: "ja", l: "Ja" },
  { v: "nein", l: "Nein" },
  { v: "vielleicht", l: "Vielleicht" },
] as const;

const valueColor = (value: string) => {
  if (value === "ja")
    return "border-emerald-400 bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-50";
  if (value === "nein")
    return "border-red-400 bg-red-100 text-red-950 dark:bg-red-900/60 dark:text-red-50";
  return "border-amber-400 bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50";
};

const personKey = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

function Sel({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { v: string; l: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 w-full", valueColor(value))}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem
            key={option.v}
            value={option.v}
            className={valueColor(option.v)}
          >
            {option.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function Helpers() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: helpers = [], isLoading } = trpc.helpers.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: plan } = trpc.plan.evaluate.useQuery();
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [apFilter, setApFilter] = useState("alle");
  const [sortAsc, setSortAsc] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const invalidate = () => {
    utils.helpers.list.invalidate();
    utils.plan.evaluate.invalidate();
    utils.dashboard.stats.invalidate();
  };
  const create = trpc.helpers.create.useMutation({
    onSuccess: () => {
      invalidate();
      setName("");
      toast.success("Helfer hinzugefügt");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.helpers.update.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(error.message),
  });
  const remove = trpc.helpers.remove.useMutation({
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Entfernt");
    },
    onError: error => toast.error(error.message),
  });
  const exportPdf = trpc.pdf.helper.useMutation({
    onSuccess: (result, variables) => {
      const helper = helpers.find(item => item.id === variables.helperId);
      downloadBase64File(
        result.base64,
        result.mimeType,
        `Aufgaben_${safeDownloadName(helper?.name ?? String(variables.helperId))}.pdf`
      );
      setExportingId(null);
    },
    onError: error => {
      setExportingId(null);
      toast.error(error.message);
    },
  });

  const filtered = useMemo(
    () =>
      helpers
        .filter(
          helper =>
            (!filter ||
              helper.name.toLowerCase().includes(filter.toLowerCase())) &&
            (apFilter === "alle" ||
              (apFilter === "ohne"
                ? !helper.contactId
                : String(helper.contactId ?? "") === apFilter))
        )
        .sort((a, b) =>
          sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        ),
    [helpers, filter, apFilter, sortAsc]
  );
  const selfHelperIds = useMemo(() => {
    const contactById = new Map(contacts.map(contact => [contact.id, contact]));
    return new Set(
      helpers
        .filter(helper => {
          const contact = helper.contactId
            ? contactById.get(helper.contactId)
            : undefined;
          return contact && personKey(contact.name) === personKey(helper.name);
        })
        .map(helper => helper.id)
    );
  }, [contacts, helpers]);
  const assignedHelperIds = useMemo(
    () =>
      new Set((plan ?? []).flatMap(item => item.assigned.map(a => a.helperId))),
    [plan]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Helfer</h1>
          <p className="text-muted-foreground">
            Helferdaten, Tagesverfügbarkeit, Hinweise und persönliche
            Aufgaben-PDFs.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <ResetAreaButton area="helpers" label="Helfer" compact />
          <Input
            placeholder="Name"
            value={name}
            onChange={event => setName(event.target.value)}
            className="w-52"
            onKeyDown={event =>
              event.key === "Enter" &&
              name.trim() &&
              create.mutate({ name: name.trim() })
            }
          />
          <Button
            onClick={() => name.trim() && create.mutate({ name: name.trim() })}
          >
            Hinzufügen
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Suchen …"
          value={filter}
          onChange={event => setFilter(event.target.value)}
          className="w-56"
        />
        <Select value={apFilter} onValueChange={setApFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Ansprechpartner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Ansprechpartner</SelectItem>
            <SelectItem
              value="ohne"
              className="bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50"
            >
              Ohne Ansprechpartner
            </SelectItem>
            {contacts.map(contact => (
              <SelectItem key={contact.id} value={String(contact.id)}>
                {contact.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="overflow-hidden p-0">
          <table className="w-full table-fixed text-xs xl:text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th
                  className="w-[12%] cursor-pointer select-none p-2"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  Name {sortAsc ? "▲" : "▼"}
                </th>
                <th className="w-[14%] p-2">Ansprechpartner</th>
                <th className="w-[10%] p-2">Telefon Helfer</th>
                <th className="w-[19%] p-2">Hinweis für PDF</th>
                <th className="w-[7%] p-2">Helfen?</th>
                <th className="w-[7%] p-2">Fr</th>
                <th className="w-[7%] p-2">Sa</th>
                <th className="w-[7%] p-2">So</th>
                <th className="w-[7%] p-2">Bestätigt?</th>
                <th className="w-[10%] p-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={10}>
                    Lade …
                  </td>
                </tr>
              )}
              {filtered.map(helper => (
                <tr
                  key={helper.id}
                  className="border-t hover:bg-muted/30 align-top"
                >
                  <td className="p-2 font-medium">
                    {helper.name}
                    {selfHelperIds.has(helper.id) && (
                      <div className="text-xs font-normal text-muted-foreground">
                        eigener Ansprechpartner-Eintrag
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <Select
                      disabled={selfHelperIds.has(helper.id)}
                      value={
                        helper.contactId ? String(helper.contactId) : "none"
                      }
                      onValueChange={value =>
                        update.mutate({
                          id: helper.id,
                          contactId: value === "none" ? null : Number(value),
                        })
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 w-full",
                          !helper.contactId &&
                            "border-amber-400 bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="none"
                          className="bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50"
                        >
                          Kein Ansprechpartner
                        </SelectItem>
                        {contacts.map(contact => (
                          <SelectItem
                            key={contact.id}
                            value={String(contact.id)}
                          >
                            {contact.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      key={`${helper.id}-phone-${helper.phone ?? ""}`}
                      type="tel"
                      className="h-8 w-full min-w-0"
                      defaultValue={helper.phone ?? ""}
                      placeholder="optional"
                      onBlur={event => {
                        const value = event.target.value.trim();
                        if (value !== (helper.phone ?? "")) {
                          update.mutate({
                            id: helper.id,
                            phone: value || null,
                          });
                        }
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      key={`${helper.id}-note-${helper.note ?? ""}`}
                      className="h-8 w-full min-w-0"
                      defaultValue={helper.note ?? ""}
                      placeholder="Verfügbarkeit / Bemerkung"
                      onBlur={event => {
                        const value = event.target.value.trim();
                        if (value !== (helper.note ?? "")) {
                          update.mutate({ id: helper.id, note: value || null });
                        }
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <Sel
                      value={helper.willHelp}
                      options={YN}
                      onChange={value =>
                        update.mutate({
                          id: helper.id,
                          willHelp: value as "ja" | "nein",
                        })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Sel
                      value={helper.availFri}
                      options={YNV}
                      onChange={value =>
                        update.mutate({
                          id: helper.id,
                          availFri: value as "ja" | "nein" | "vielleicht",
                        })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Sel
                      value={helper.availSat}
                      options={YNV}
                      onChange={value =>
                        update.mutate({
                          id: helper.id,
                          availSat: value as "ja" | "nein" | "vielleicht",
                        })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Sel
                      value={helper.availSun}
                      options={YNV}
                      onChange={value =>
                        update.mutate({
                          id: helper.id,
                          availSun: value as "ja" | "nein" | "vielleicht",
                        })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Sel
                      value={helper.confirmed}
                      options={YN}
                      onChange={value =>
                        update.mutate({
                          id: helper.id,
                          confirmed: value as "ja" | "nein",
                        })
                      }
                    />
                  </td>
                  <td className="p-1">
                    <div className="flex min-w-0 justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Persönliche Aufgabenübersicht als PDF"
                        disabled={exportingId === helper.id}
                        onClick={() => {
                          setExportingId(helper.id);
                          exportPdf.mutate({ helperId: helper.id });
                        }}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={
                          selfHelperIds.has(helper.id)
                            ? "Zum Löschen zuerst den Ansprechpartner entfernen"
                            : user?.role !== "admin" &&
                                assignedHelperIds.has(helper.id)
                              ? "Eingeteilte Helfer können nur Administratoren löschen"
                              : "Löschen"
                        }
                        disabled={
                          selfHelperIds.has(helper.id) ||
                          (user?.role !== "admin" &&
                            assignedHelperIds.has(helper.id))
                        }
                        onClick={() =>
                          setDeleteTarget({
                            id: helper.id,
                            name: helper.name,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={10}>
                    Keine Helfer gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Legende: <StatusBadge status="ja" /> verfügbar ·{" "}
        <StatusBadge status="vielleicht" /> unsicher ·{" "}
        <StatusBadge status="nein" />
        abgesagt/nicht verfügbar
      </p>
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Helfer löschen?"
        description={`„${deleteTarget?.name ?? ""}“ wird aus der Helferliste und allen Einsatzzuordnungen des aktuellen Jahres gelöscht.`}
        busy={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id })}
      />
    </div>
  );
}

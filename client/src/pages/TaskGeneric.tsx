import { useAuth } from "@/_core/hooks/useAuth";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ResetAreaButton } from "@/components/ResetAreaButton";
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
import { trpc } from "@/lib/trpc";
import { ArrowDownAZ, ArrowUpZA, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const resetAreaByKind = {
  materials: "materials",
  marketing: "marketing",
  approvals: "approvals",
  cakes: "cakes",
} as const;

interface Col {
  key: string;
  label: string;
}
interface Props {
  kind: string;
  title: string;
  addLabel: string;
  nameKey: string;
  columns: Col[];
  statusField?: boolean;
  statusOptions?: { v: string; l: string }[];
  extraField?: {
    key: string;
    label: string;
    options: { v: string; l: string }[];
  };
  noContact?: boolean;
  noStatus?: boolean;
  sortableAndFilterable?: boolean;
  teamCanDelete?: boolean;
}

const temporaryId = () => -Date.now() - Math.floor(Math.random() * 1_000);

export default function TaskGeneric({
  kind,
  title,
  addLabel,
  nameKey,
  columns,
  statusOptions,
  extraField,
  noContact,
  noStatus,
  sortableAndFilterable = false,
  teamCanDelete = false,
}: Props) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const api = (trpc as any)[kind];
  const listUtils = (utils as any)[kind].list;
  const { data: rows = [], isLoading } = api.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const [name, setName] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [contactFilter, setContactFilter] = useState("alle");
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const defaultStatus = statusOptions ?? [
    { v: "offen", l: "offen" },
    { v: "inArbeit", l: "in Arbeit" },
    { v: "erledigt", l: "erledigt" },
  ];

  const visibleRows = useMemo(
    () =>
      [...rows]
        .filter((row: any) => {
          if (!sortableAndFilterable || contactFilter === "alle") return true;
          if (contactFilter === "ohne") return !row.contactId;
          return String(row.contactId ?? "") === contactFilter;
        })
        .sort((left: any, right: any) => {
          if (!sortableAndFilterable) return 0;
          const comparison = String(left[nameKey] ?? "").localeCompare(
            String(right[nameKey] ?? ""),
            "de",
            { sensitivity: "base" }
          );
          return sortAsc ? comparison : -comparison;
        }),
    [rows, sortableAndFilterable, contactFilter, nameKey, sortAsc]
  );

  const refreshDashboard = () => void utils.dashboard.stats.invalidate();

  const create = api.create.useMutation({
    onMutate: async (input: any) => {
      await listUtils.cancel();
      const previous = listUtils.getData();
      const optimisticId = temporaryId();
      listUtils.setData(undefined, (current: any[] = []) => [
        ...current,
        {
          id: optimisticId,
          year: 0,
          [nameKey]: input[nameKey],
          ...Object.fromEntries(
            columns.map(column => [column.key, input[column.key] ?? ""])
          ),
          contactId: input.contactId ?? null,
          status: input.status ?? defaultStatus[0]?.v ?? "offen",
          ...(extraField
            ? {
                [extraField.key]:
                  input[extraField.key] ?? extraField.options[0]?.v ?? "",
              }
            : {}),
          note: input.note ?? null,
          sortOrder: 0,
        },
      ]);
      return { previous, optimisticId };
    },
    onSuccess: (created: any, _input: any, context: any) => {
      listUtils.setData(undefined, (current: any[] = []) =>
        current.map(row => (row.id === context?.optimisticId ? created : row))
      );
      setName("");
      setExtras({});
      toast.success("Hinzugefügt");
    },
    onError: (error: any, _input: any, context: any) => {
      listUtils.setData(undefined, context?.previous);
      toast.error(error.message);
    },
    onSettled: refreshDashboard,
  });

  const update = api.update.useMutation({
    onMutate: async (input: any) => {
      await listUtils.cancel();
      const previous = listUtils.getData();
      listUtils.setData(undefined, (current: any[] = []) =>
        current.map(row => (row.id === input.id ? { ...row, ...input } : row))
      );
      return { previous };
    },
    onError: (error: any, _input: any, context: any) => {
      listUtils.setData(undefined, context?.previous);
      toast.error(error.message);
    },
    onSettled: refreshDashboard,
  });

  const remove = api.remove.useMutation({
    onMutate: async (input: { id: number }) => {
      await listUtils.cancel();
      const previous = listUtils.getData();
      listUtils.setData(undefined, (current: any[] = []) =>
        current.filter(row => row.id !== input.id)
      );
      return { previous };
    },
    onSuccess: () => {
      setDeleteTarget(null);
      toast.success("Entfernt");
    },
    onError: (error: any, _input: any, context: any) => {
      listUtils.setData(undefined, context?.previous);
      toast.error(error.message);
    },
    onSettled: refreshDashboard,
  });

  const submitCreate = () => {
    if (!name.trim() || create.isPending) return;
    create.mutate({ [nameKey]: name.trim(), ...extras });
  };

  const tableColumnCount =
    2 +
    columns.length +
    (noContact ? 0 : 1) +
    (noStatus ? 0 : 1) +
    (extraField ? 1 : 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex flex-wrap justify-end gap-2">
          {kind in resetAreaByKind && (
            <ResetAreaButton
              area={resetAreaByKind[kind as keyof typeof resetAreaByKind]}
              label={title}
              compact
            />
          )}
          <Input
            placeholder={`Neu: ${addLabel}`}
            value={name}
            onChange={event => setName(event.target.value)}
            className="w-64"
            onKeyDown={event => event.key === "Enter" && submitCreate()}
          />
          {columns.map(column => (
            <Input
              key={column.key}
              placeholder={column.label}
              value={extras[column.key] ?? ""}
              onChange={event =>
                setExtras(current => ({
                  ...current,
                  [column.key]: event.target.value,
                }))
              }
              className="w-36"
            />
          ))}
          <Button
            onClick={submitCreate}
            disabled={!name.trim() || create.isPending}
          >
            {create.isPending ? "Speichert …" : "Hinzufügen"}
          </Button>
        </div>
      </div>
      {sortableAndFilterable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSortAsc(value => !value)}
          >
            {sortAsc ? (
              <ArrowDownAZ className="mr-2 h-4 w-4" />
            ) : (
              <ArrowUpZA className="mr-2 h-4 w-4" />
            )}
            {addLabel} {sortAsc ? "A–Z" : "Z–A"}
          </Button>
          {!noContact && (
            <Select value={contactFilter} onValueChange={setContactFilter}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Verantwortliche filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Verantwortlichen</SelectItem>
                <SelectItem value="ohne">Ohne Verantwortlichen</SelectItem>
                {contacts.map(contact => (
                  <SelectItem key={contact.id} value={String(contact.id)}>
                    {contact.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-sm text-muted-foreground">
            {visibleRows.length} von {rows.length} Einträgen
          </span>
        </div>
      )}
      <Card className="shadow-sm">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3">{addLabel}</th>
                {columns.map(column => (
                  <th key={column.key} className="p-3">
                    {column.label}
                  </th>
                ))}
                {!noContact && <th className="p-3">Verantwortlich</th>}
                {!noStatus && <th className="p-3">Status</th>}
                {extraField && <th className="p-3">{extraField.label}</th>}
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    className="p-4 text-muted-foreground"
                    colSpan={tableColumnCount}
                  >
                    Lade …
                  </td>
                </tr>
              )}
              {visibleRows.map((row: any) => (
                <tr key={row.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <Input
                      className="h-8 w-full min-w-[140px] font-medium"
                      defaultValue={row[nameKey] ?? ""}
                      onBlur={event => {
                        if (event.target.value !== (row[nameKey] ?? ""))
                          update.mutate({
                            id: row.id,
                            [nameKey]: event.target.value,
                          });
                      }}
                    />
                  </td>
                  {columns.map(column => (
                    <td key={column.key} className="p-2">
                      <Input
                        className="h-8 w-full min-w-[90px]"
                        defaultValue={row[column.key] ?? ""}
                        onBlur={event => {
                          if (event.target.value !== (row[column.key] ?? ""))
                            update.mutate({
                              id: row.id,
                              [column.key]: event.target.value,
                            });
                        }}
                      />
                    </td>
                  ))}
                  {!noContact && (
                    <td className="p-2">
                      <Select
                        value={row.contactId ? String(row.contactId) : "none"}
                        onValueChange={value =>
                          update.mutate({
                            id: row.id,
                            contactId: value === "none" ? null : Number(value),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
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
                  )}
                  {!noStatus && (
                    <td className="p-2">
                      <Select
                        value={row.status}
                        onValueChange={value =>
                          update.mutate({ id: row.id, status: value })
                        }
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {defaultStatus.map(option => (
                            <SelectItem key={option.v} value={option.v}>
                              {option.l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  {extraField && (
                    <td className="p-2">
                      <Select
                        value={
                          row[extraField.key] ?? extraField.options[0]?.v ?? ""
                        }
                        onValueChange={value =>
                          update.mutate({
                            id: row.id,
                            [extraField.key]: value,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {extraField.options.map(option => (
                            <SelectItem key={option.v} value={option.v}>
                              {option.l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  <td className="p-2">
                    {(user?.role === "admin" || teamCanDelete) &&
                      row.id > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${addLabel} ${row[nameKey]} löschen`}
                          disabled={remove.isPending}
                          onClick={() =>
                            teamCanDelete
                              ? setDeleteTarget({
                                  id: row.id,
                                  name: String(row[nameKey] ?? ""),
                                })
                              : remove.mutate({ id: row.id })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
              {!isLoading && visibleRows.length === 0 && (
                <tr>
                  <td
                    className="p-4 text-muted-foreground"
                    colSpan={tableColumnCount}
                  >
                    {rows.length === 0
                      ? "Noch keine Einträge."
                      : "Keine Einträge für diesen Verantwortlichen."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {teamCanDelete && (
        <ConfirmDeleteDialog
          open={Boolean(deleteTarget)}
          onOpenChange={open => !open && setDeleteTarget(null)}
          title={`${addLabel} löschen?`}
          description={`„${deleteTarget?.name ?? ""}“ wird aus ${title} im aktuellen Veranstaltungsjahr gelöscht.`}
          busy={remove.isPending}
          onConfirm={() =>
            deleteTarget && remove.mutate({ id: deleteTarget.id })
          }
        />
      )}
    </div>
  );
}

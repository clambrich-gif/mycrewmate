import { useAuth } from "@/_core/hooks/useAuth";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CREATION_ACTION_BUTTON_CLASS } from "@/lib/creation-action";
import { trpc } from "@/lib/trpc";
import { ArrowDownAZ, ArrowUpZA, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { LocationMapLink } from "@/components/LocationMapLink";

const resetAreaByKind = {
  materials: "materials",
  marketing: "marketing",
  approvals: "approvals",
  cakes: "cakes",
} as const;

const importAreaByKind = {
  materials: "MATERIAL",
  marketing: "MARKETING",
  approvals: "GENEHMIGUNGEN",
  cakes: "KUCHEN",
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
  createInDialog?: boolean;
  createDialogTitle?: string;
  createTriggerLabel?: string;
  locationField?: boolean;
  headerActions?: ReactNode;
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
  createInDialog = false,
  createDialogTitle = `Neu: ${addLabel}`,
  createTriggerLabel = `Neu: ${addLabel}`,
  locationField = false,
  headerActions,
}: Props) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const api = (trpc as any)[kind];
  const listUtils = (utils as any)[kind].list;
  const { data: rows = [], isLoading } = api.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: locations = [] } = trpc.locations.list.useQuery();
  const [name, setName] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [contactFilter, setContactFilter] = useState("alle");
  const [sortAsc, setSortAsc] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
          locationId: input.locationId ?? null,
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
      setCreateDialogOpen(false);
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
    const { locationId, ...restExtras } = extras;
    create.mutate({
      [nameKey]: name.trim(),
      ...restExtras,
      ...(locationField
        ? { locationId: locationId === "none" || !locationId ? null : Number(locationId) }
        : {}),
    });
  };

  const resetCreateForm = () => {
    setName("");
    setExtras(
      {
        ...(extraField
          ? { [extraField.key]: extraField.options[0]?.v ?? "" }
          : {}),
        ...(locationField ? { locationId: "none" } : {}),
      }
    );
  };

  const openCreateDialog = () => {
    resetCreateForm();
    setCreateDialogOpen(true);
  };

  const tableColumnCount =
    2 +
    columns.length +
    (noContact ? 0 : 1) +
    (locationField ? 1 : 0) +
    (noStatus ? 0 : 1) +
    (extraField ? 1 : 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 max-lg:[&>[data-slot=button]]:h-11 max-lg:[&>[data-slot=button]]:text-base lg:[&>[data-slot=button]]:w-auto lg:[&>[data-slot=button]]:px-4">
          {kind in importAreaByKind && (
            <ModuleExcelImportButton
              area={importAreaByKind[kind as keyof typeof importAreaByKind]}
              label={title}
            />
          )}
          {kind in resetAreaByKind && (
            <ResetAreaButton
              area={resetAreaByKind[kind as keyof typeof resetAreaByKind]}
              label={title}
              compact
            />
          )}
          {headerActions}
          {createInDialog ? (
            <Button
              type="button"
              variant="outline"
              className={`col-span-2 shadow-xs lg:col-auto ${CREATION_ACTION_BUTTON_CLASS}`}
              onClick={openCreateDialog}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              <span>{createTriggerLabel}</span>
            </Button>
          ) : (
            <>
              <Input
                placeholder={`Neu: ${addLabel}`}
                value={name}
                onChange={event => setName(event.target.value)}
                className="col-span-2 w-full lg:order-last lg:w-64"
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
                  className="col-span-2 w-full lg:order-last lg:ml-2 lg:w-36"
                />
              ))}
              <Button
                className="col-span-2 shadow-xs lg:col-auto"
                onClick={submitCreate}
                disabled={!name.trim() || create.isPending}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                <span>
                  {create.isPending ? "Speichert …" : `Neu: ${addLabel}`}
                </span>
              </Button>
            </>
          )}
        </div>
      </div>
      {sortableAndFilterable && (
        <div className="flex w-full flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <Button
            type="button"
            variant="outline"
            className="w-full lg:w-auto"
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
              <SelectTrigger className="w-full lg:w-[240px]">
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
          <span className="w-full text-sm text-muted-foreground lg:w-auto">
            {visibleRows.length} von {rows.length} Einträgen
          </span>
        </div>
      )}
      <div className="space-y-3 md:hidden">
        {isLoading && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Lade …
            </CardContent>
          </Card>
        )}
        {visibleRows.map((row: any) => (
          <Card key={row.id} className="shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {addLabel}
                </span>
                <Input
                  className="h-11 w-full font-medium md:h-10"
                  defaultValue={row[nameKey] ?? ""}
                  onBlur={event => {
                    if (event.target.value !== (row[nameKey] ?? ""))
                      update.mutate({
                        id: row.id,
                        [nameKey]: event.target.value,
                      });
                  }}
                />
              </div>
              {columns.map(column => (
                <div key={column.key} className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {column.label}
                  </span>
                  <Input
                    className="h-11 w-full md:h-10"
                    defaultValue={row[column.key] ?? ""}
                    onBlur={event => {
                      if (event.target.value !== (row[column.key] ?? ""))
                        update.mutate({
                          id: row.id,
                          [column.key]: event.target.value,
                        });
                    }}
                  />
                </div>
              ))}
              {!noContact && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Verantwortlich
                  </span>
                  <Select
                    value={row.contactId ? String(row.contactId) : "none"}
                    onValueChange={value =>
                      update.mutate({
                        id: row.id,
                        contactId: value === "none" ? null : Number(value),
                      })
                    }
                  >
                    <SelectTrigger className="h-11 w-full md:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {contacts.map(contact => (
                        <SelectItem key={contact.id} value={String(contact.id)}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {locationField && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Ort / Zielstandort
                  </span>
                  <Select
                    value={row.locationId ? String(row.locationId) : "none"}
                    onValueChange={value =>
                      update.mutate({
                        id: row.id,
                        locationId: value === "none" ? null : Number(value),
                      })
                    }
                  >
                    <SelectTrigger className="h-11 w-full md:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Ort</SelectItem>
                      {locations.map(location => (
                        <SelectItem key={location.id} value={String(location.id)}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <LocationMapLink
                    locationId={row.locationId}
                    locations={locations}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {!noStatus && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Status
                    </span>
                    <Select
                      value={row.status}
                      onValueChange={value =>
                        update.mutate({ id: row.id, status: value })
                      }
                    >
                      <SelectTrigger className="h-11 w-full md:h-10">
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
                  </div>
                )}
                {extraField && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {extraField.label}
                    </span>
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
                      <SelectTrigger className="h-11 w-full md:h-10">
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
                  </div>
                )}
              </div>
              {(user?.role === "admin" || teamCanDelete) && row.id > 0 && (
                <Button
                  variant="outline"
                  className="w-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
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
                  <Trash2 className="mr-2 h-4 w-4" /> {addLabel} löschen
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && visibleRows.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-muted-foreground">
              {rows.length === 0
                ? "Noch keine Einträge."
                : "Keine Einträge für diesen Verantwortlichen."}
            </CardContent>
          </Card>
        )}
      </div>
      <Card className="hidden shadow-sm md:block">
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
                {locationField && <th className="p-3">Ort</th>}
                {!noStatus && <th className="p-3 text-center">Status</th>}
                {extraField && (
                  <th className="p-3 text-center">{extraField.label}</th>
                )}
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
                  {locationField && (
                    <td className="p-2 align-middle">
                      <div className="flex min-w-[190px] items-center gap-1.5">
                        <Select
                          value={row.locationId ? String(row.locationId) : "none"}
                          onValueChange={value =>
                            update.mutate({
                              id: row.id,
                              locationId: value === "none" ? null : Number(value),
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-[165px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Kein Ort</SelectItem>
                            {locations.map(location => (
                              <SelectItem key={location.id} value={String(location.id)}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <LocationMapLink
                          locationId={row.locationId}
                          locations={locations}
                          className="shrink-0"
                        />
                      </div>
                    </td>
                  )}
                  {!noStatus && (
                    <td className="p-2 text-center align-middle">
                      <div className="flex items-center justify-center">
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
                      </div>
                    </td>
                  )}
                  {extraField && (
                    <td className="p-2 text-center align-middle">
                      <div className="flex items-center justify-center">
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
                      </div>
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
      {createInDialog && (
        <Dialog
          open={createDialogOpen}
          onOpenChange={open => {
            if (!open && !create.isPending) {
              setCreateDialogOpen(false);
              resetCreateForm();
            }
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] !bg-white !text-slate-950 shadow-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{createDialogTitle}</DialogTitle>
            </DialogHeader>
            <form
              className="grid min-w-0 gap-3 py-2"
              onSubmit={event => {
                event.preventDefault();
                submitCreate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor={`${kind}-create-name`}>
                  {addLabel} <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id={`${kind}-create-name`}
                  value={name}
                  autoFocus
                  required
                  placeholder={`z. B. ${addLabel}`}
                  onChange={event => setName(event.target.value)}
                />
              </div>
              {columns.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {columns.map(column => (
                    <div key={column.key} className="space-y-1.5">
                      <Label htmlFor={`${kind}-create-${column.key}`}>
                        {column.label}
                      </Label>
                      <Input
                        id={`${kind}-create-${column.key}`}
                        value={extras[column.key] ?? ""}
                        onChange={event =>
                          setExtras(current => ({
                            ...current,
                            [column.key]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              {locationField && (
                <div className="space-y-1.5">
                  <Label htmlFor={`${kind}-create-location`}>Ort / Zielstandort (optional)</Label>
                  <Select
                    value={extras.locationId ?? "none"}
                    onValueChange={value =>
                      setExtras(current => ({ ...current, locationId: value }))
                    }
                  >
                    <SelectTrigger id={`${kind}-create-location`}>
                      <SelectValue placeholder="Kein Ort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Ort</SelectItem>
                      {locations.map(location => (
                        <SelectItem key={location.id} value={String(location.id)}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {extraField && (
                <div className="space-y-1.5">
                  <Label htmlFor={`${kind}-create-${extraField.key}`}>
                    {extraField.label}
                  </Label>
                  <Select
                    value={
                      extras[extraField.key] ?? extraField.options[0]?.v ?? ""
                    }
                    onValueChange={value =>
                      setExtras(current => ({
                        ...current,
                        [extraField.key]: value,
                      }))
                    }
                  >
                    <SelectTrigger id={`${kind}-create-${extraField.key}`}>
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
                </div>
              )}
              <DialogFooter className="mt-1 w-full min-w-0 flex-col gap-3 border-t pt-3 sm:flex-col sm:items-stretch">
                <div className="flex w-full flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={create.isPending}
                    onClick={() => {
                      setCreateDialogOpen(false);
                      resetCreateForm();
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="submit"
                    disabled={!name.trim() || create.isPending}
                  >
                    {create.isPending ? "Speichert …" : "Speichern"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

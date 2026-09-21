import { useAuth } from "@/_core/hooks/useAuth";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PlanResetDialogButton } from "@/components/PlanResetDialogButton";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { MyTasksDefaultPin } from "@/components/MyTasksDefaultPin";
import { PageTitle, type PageTitleIconKind } from "@/components/PageTitle";
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
import {
  STICKY_TABLE_CONTAINER_CLASS,
  STICKY_TABLE_HEADER_CLASS,
  STICKY_TABLE_HEADER_CELL_CLASS,
} from "@/lib/sticky-table";
import { trpc } from "@/lib/trpc";
import { useMyTasksDefault } from "@/hooks/useMyTasksDefault";
import {
  ArrowDownAZ,
  ArrowUpZA,
  FilterX,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LocationMapLink } from "@/components/LocationMapLink";

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
  titleIcon?: PageTitleIconKind;
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
  deletionRequiresContact?: boolean;
  createInDialog?: boolean;
  createDialogTitle?: string;
  createTriggerLabel?: string;
  createButtonClassName?: string;
  locationField?: boolean;
  headerActions?:
    | ReactNode
    | ((context: { visibleRows: Array<Record<string, unknown>> }) => ReactNode);
  headerLayout?: "default" | "stacked";
  stackedActionColumns?: 2 | 3 | 4;
  clearAssignmentsArea?: "prep" | "post" | "materials";
  filterConfig?: {
    categoryKey: string;
    categoryLabel: string;
    statusKey?: string;
    statusLabel?: string;
    searchPlaceholder?: string;
  };
}

const temporaryId = () => -Date.now() - Math.floor(Math.random() * 1_000);

export default function TaskGeneric({
  kind,
  title,
  titleIcon = "materials",
  addLabel,
  nameKey,
  columns,
  statusOptions,
  extraField,
  noContact,
  noStatus,
  sortableAndFilterable = false,
  teamCanDelete = false,
  deletionRequiresContact = false,
  createInDialog = false,
  createDialogTitle = `Neu: ${addLabel}`,
  createTriggerLabel = `Neu: ${addLabel}`,
  createButtonClassName = CREATION_ACTION_BUTTON_CLASS,
  locationField = false,
  headerActions,
  headerLayout = "default",
  stackedActionColumns = 4,
  clearAssignmentsArea,
  filterConfig,
}: Props) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const {
    isDefaultMyTasks,
    setDefaultMyTasks,
    canRememberMyTasksDefault,
  } = useMyTasksDefault(user);
  const api = (trpc as any)[kind];
  const listUtils = (utils as any)[kind].list;
  const { data: rows = [], isLoading } = api.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: locations = [] } = trpc.locations.list.useQuery();
  const [name, setName] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [contactFilter, setContactFilter] = useState("alle");
  const [categoryFilter, setCategoryFilter] = useState("alle");
  const [locationFilter, setLocationFilter] = useState("alle");
  const [fieldFilter, setFieldFilter] = useState("alle");
  const [searchTerm, setSearchTerm] = useState("");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [openOrUnassignedOnly, setOpenOrUnassignedOnly] = useState(false);
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
  const filterCategoryKey = filterConfig?.categoryKey;
  const filterStatusKey = filterConfig?.statusKey;
  const filterStatusOptions = extraField?.options ?? defaultStatus;
  const isMaterialTable = kind === "materials";

  const contactMap = useMemo(
    () => new Map(contacts.map((contact: any) => [contact.id, contact.name])),
    [contacts]
  );
  const ownContactId = useMemo(() => {
    const currentName = user?.name?.trim().toLocaleLowerCase("de-DE");
    if (!currentName) return null;
    return (
      contacts.find(
        (contact: any) =>
          String(contact.name ?? "").trim().toLocaleLowerCase("de-DE") === currentName
      )?.id ?? null
    );
  }, [contacts, user?.name]);
  useEffect(() => {
    if (isDefaultMyTasks && ownContactId !== null) {
      setMyTasksOnly(true);
    }
  }, [isDefaultMyTasks, ownContactId]);
  const updateMyTasksDefault = (enabled: boolean) => {
    setDefaultMyTasks(enabled);
    if (!enabled) setMyTasksOnly(false);
    else if (ownContactId !== null) setMyTasksOnly(true);
  };
  const locationMap = useMemo(
    () => new Map(locations.map((location: any) => [location.id, location.name])),
    [locations]
  );
  const availableCategories = useMemo(() => {
    if (!filterCategoryKey) return [];
    return Array.from(
      new Set<string>(
        rows
          .map((row: any) => String(row[filterCategoryKey] ?? "").trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, "de"));
  }, [filterCategoryKey, rows]);

  const visibleRows = useMemo(
    () =>
      [...rows]
        .filter((row: any) => {
          if ((sortableAndFilterable || filterConfig) && contactFilter !== "alle") {
            if (contactFilter === "ohne" && row.contactId) return false;
            if (
              contactFilter !== "ohne" &&
              String(row.contactId ?? "") !== contactFilter
            ) {
              return false;
            }
          }
          if (myTasksOnly && row.contactId !== ownContactId) return false;
          if (
            openOrUnassignedOnly &&
            row.contactId &&
            (!filterStatusKey || String(row[filterStatusKey] ?? "") !== "offen")
          ) {
            return false;
          }

          if (!filterConfig) return true;
          if (
            categoryFilter !== "alle" &&
            String(row[filterCategoryKey ?? ""] ?? "").trim() !== categoryFilter
          ) {
            return false;
          }
          if (locationFilter === "ohne" && row.locationId) return false;
          if (
            locationFilter !== "alle" &&
            locationFilter !== "ohne" &&
            String(row.locationId ?? "") !== locationFilter
          ) {
            return false;
          }
          if (
            filterStatusKey &&
            fieldFilter !== "alle" &&
            String(row[filterStatusKey] ?? "") !== fieldFilter
          ) {
            return false;
          }

          const normalizedQuery = searchTerm.trim().toLocaleLowerCase("de-DE");
          if (!normalizedQuery) return true;
          const searchable = [
            row[nameKey],
            ...columns.map(column => row[column.key]),
            row.contactId ? contactMap.get(row.contactId) ?? "" : "",
            row.locationId ? locationMap.get(row.locationId) ?? "" : "",
            filterStatusKey ? row[filterStatusKey] : "",
          ]
            .join(" ")
            .toLocaleLowerCase("de-DE");
          return searchable.includes(normalizedQuery);
        })
        .sort((left: any, right: any) => {
          if (!sortableAndFilterable || filterConfig) return 0;
          const comparison = String(left[nameKey] ?? "").localeCompare(
            String(right[nameKey] ?? ""),
            "de",
            { sensitivity: "base" }
          );
          return sortAsc ? comparison : -comparison;
        }),
    [
      rows,
      sortableAndFilterable,
      filterConfig,
      contactFilter,
      myTasksOnly,
      openOrUnassignedOnly,
      ownContactId,
      categoryFilter,
      locationFilter,
      fieldFilter,
      searchTerm,
      filterCategoryKey,
      filterStatusKey,
      nameKey,
      columns,
      contactMap,
      locationMap,
      sortAsc,
    ]
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
  const renderedHeaderActions =
    typeof headerActions === "function"
      ? headerActions({ visibleRows: visibleRows as Array<Record<string, unknown>> })
      : headerActions;
  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    categoryFilter !== "alle" ||
    locationFilter !== "alle" ||
    contactFilter !== "alle" ||
    fieldFilter !== "alle" ||
    myTasksOnly ||
    openOrUnassignedOnly;
  const resetAllFilters = () => {
    setSearchTerm("");
    setCategoryFilter("alle");
    setLocationFilter("alle");
    setContactFilter("alle");
    setFieldFilter("alle");
    setMyTasksOnly(false);
    setOpenOrUnassignedOnly(false);
  };

  return (
    <div className="space-y-5">
      <div
        className={
          headerLayout === "stacked"
            ? "flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"
            : "flex flex-wrap items-end justify-between gap-3"
        }
      >
        <PageTitle icon={titleIcon}>{title}</PageTitle>
        {headerLayout === "stacked" ? (
          <div
            className={`w-full space-y-2 xl:w-auto ${
              stackedActionColumns === 2
                ? "xl:min-w-[344px]"
                : stackedActionColumns === 3
                  ? "xl:min-w-[500px]"
                  : "xl:min-w-[660px]"
            }`}
          >
            <div
              className={`grid grid-cols-2 gap-2 [&>button]:w-full [&>button]:justify-center [&>button]:whitespace-nowrap [&>button]:px-2 lg:[&>button]:h-10 ${
                stackedActionColumns === 2
                  ? "lg:grid-cols-2"
                  : stackedActionColumns === 3
                    ? "lg:grid-cols-3"
                    : "lg:grid-cols-4"
              }`}
            >
              {renderedHeaderActions}
              {clearAssignmentsArea ? (
                <PlanResetDialogButton
                  area={clearAssignmentsArea}
                  label={title}
                />
              ) : kind in resetAreaByKind ? (
                <ResetAreaButton
                  area={resetAreaByKind[kind as keyof typeof resetAreaByKind]}
                  label={title}
                  compact
                />
              ) : null}
            </div>
            {createInDialog ? (
              <Button
                type="button"
                variant="outline"
                className={`w-full shadow-xs ${createButtonClassName}`}
                onClick={openCreateDialog}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                <span>{createTriggerLabel}</span>
              </Button>
            ) : (
              <Button
                className="w-full shadow-xs"
                onClick={submitCreate}
                disabled={!name.trim() || create.isPending}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                <span>
                  {create.isPending ? "Speichert …" : `Neu: ${addLabel}`}
                </span>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 max-lg:[&>[data-slot=button]]:h-11 max-lg:[&>[data-slot=button]]:text-base lg:[&>[data-slot=button]]:w-auto lg:[&>[data-slot=button]]:px-4">
            {kind in resetAreaByKind && (
              <ResetAreaButton
                area={resetAreaByKind[kind as keyof typeof resetAreaByKind]}
                label={title}
                compact
              />
            )}
            {renderedHeaderActions}
            {createInDialog ? (
              <Button
                type="button"
                variant="outline"
                className={`col-span-2 shadow-xs lg:col-auto ${createButtonClassName}`}
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
        )}
      </div>
      {filterConfig ? (
        <div className="space-y-3 rounded-xl border bg-slate-50/70 p-3 sm:p-4">
          <div className="relative w-full max-w-2xl">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder={filterConfig.searchPlaceholder ?? `Suchen (${addLabel}) …`}
              className="h-11 bg-white pl-9 pr-8 text-base sm:h-10 sm:text-sm"
              aria-label={`${title} durchsuchen`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-700 sm:min-h-0 sm:min-w-0"
                aria-label="Suche leeren"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div
            className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0"
            aria-label={`Schnellfilter ${title}`}
          >
            {!noContact && (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={myTasksOnly ? "default" : "outline"}
                  className={
                    myTasksOnly
                      ? "shrink-0 bg-blue-600 text-white hover:bg-blue-700"
                      : "shrink-0 border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                  }
                  disabled={ownContactId === null}
                  title={
                    ownContactId === null
                      ? "Der aktuelle Sitzungsname ist keinem Ansprechpartner zugeordnet."
                      : undefined
                  }
                  onClick={() => setMyTasksOnly(active => !active)}
                >
                  👤 Meine Aufgaben
                </Button>
                <MyTasksDefaultPin
                  pressed={isDefaultMyTasks}
                  disabled={!canRememberMyTasksDefault}
                  onPressedChange={updateMyTasksDefault}
                />
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant={openOrUnassignedOnly ? "default" : "outline"}
              className={
                openOrUnassignedOnly
                  ? "shrink-0 bg-amber-600 text-white hover:bg-amber-700"
                  : "shrink-0 border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
              }
              onClick={() => setOpenOrUnassignedOnly(active => !active)}
            >
              ⚠ Offen / unzugewiesen
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-11 w-full bg-white text-base sm:h-10 sm:text-sm">
                <SelectValue placeholder={filterConfig.categoryLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle {filterConfig.categoryLabel}</SelectItem>
                {availableCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="h-11 w-full bg-white text-base sm:h-10 sm:text-sm">
                <SelectValue placeholder="Standort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Standorte</SelectItem>
                <SelectItem value="ohne">Ohne Standort</SelectItem>
                {locations.map((location: any) => (
                  <SelectItem key={location.id} value={String(location.id)}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!noContact && (
              <Select value={contactFilter} onValueChange={setContactFilter}>
                <SelectTrigger className="h-11 w-full bg-white text-base sm:h-10 sm:text-sm">
                  <SelectValue placeholder="Verantwortlich" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Verantwortlichen</SelectItem>
                  <SelectItem value="ohne">Ohne Verantwortlichen</SelectItem>
                  {contacts.map((contact: any) => (
                    <SelectItem key={contact.id} value={String(contact.id)}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filterStatusKey && (
              <Select value={fieldFilter} onValueChange={setFieldFilter}>
                <SelectTrigger className="h-11 w-full bg-white text-base sm:h-10 sm:text-sm">
                  <SelectValue placeholder={filterConfig.statusLabel ?? "Stand"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle {filterConfig.statusLabel ?? "Stände"}</SelectItem>
                  {filterStatusOptions.map(option => (
                    <SelectItem key={option.v} value={option.v}>
                      {option.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetAllFilters}
                className="h-11 w-full px-2 text-base text-slate-600 hover:text-slate-900 xl:ml-1 xl:h-10 xl:w-auto xl:text-sm"
              >
                <FilterX className="mr-1 size-3.5" />
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </div>
      ) : sortableAndFilterable && (
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
                    (teamCanDelete || deletionRequiresContact)
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
                : filterConfig
                  ? "Keine Einträge für die aktuelle Filterauswahl."
                  : "Keine Einträge für diesen Verantwortlichen."}
            </CardContent>
          </Card>
        )}
      </div>
      <Card className="hidden shadow-sm md:block">
        <CardContent
          className={isMaterialTable ? `${STICKY_TABLE_CONTAINER_CLASS} p-0` : "overflow-x-auto p-0"}
        >
          <table className="w-full text-sm">
            <thead
              data-sticky-table-header={isMaterialTable ? "materials" : undefined}
              className={isMaterialTable ? STICKY_TABLE_HEADER_CLASS : "bg-muted/60"}
            >
              <tr className="text-left">
                <th className={isMaterialTable ? STICKY_TABLE_HEADER_CELL_CLASS : "p-3"}>{addLabel}</th>
                {columns.map(column => (
                  <th key={column.key} className={isMaterialTable ? STICKY_TABLE_HEADER_CELL_CLASS : "p-3"}>
                    {column.label}
                  </th>
                ))}
                {!noContact && <th className={isMaterialTable ? STICKY_TABLE_HEADER_CELL_CLASS : "p-3"}>Verantwortlich</th>}
                {locationField && <th className={isMaterialTable ? STICKY_TABLE_HEADER_CELL_CLASS : "p-3"}>Ort</th>}
                {!noStatus && <th className={isMaterialTable ? `${STICKY_TABLE_HEADER_CELL_CLASS} text-center` : "p-3 text-center"}>Status</th>}
                {extraField && (
                  <th className={isMaterialTable ? `${STICKY_TABLE_HEADER_CELL_CLASS} text-center` : "p-3 text-center"}>{extraField.label}</th>
                )}
                <th className={isMaterialTable ? `w-10 ${STICKY_TABLE_HEADER_CELL_CLASS}` : "w-10 p-3"}></th>
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
                            (teamCanDelete || deletionRequiresContact)
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
                      : filterConfig
                        ? "Keine Einträge für die aktuelle Filterauswahl."
                        : "Keine Einträge für diesen Verantwortlichen."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {(teamCanDelete || deletionRequiresContact) && (
        <ConfirmDeleteDialog
          open={Boolean(deleteTarget)}
          onOpenChange={open => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title={`${addLabel} löschen?`}
          description={`„${deleteTarget?.name ?? ""}“ wird aus ${title} im aktuellen Veranstaltungsjahr gelöscht.`}
          busy={remove.isPending}
          onConfirm={() => {
            if (!deleteTarget) return;
            remove.mutate({ id: deleteTarget.id });
          }}
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

import { useAuth } from "@/_core/hooks/useAuth";
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
import {
  parseTaskStatusFilter,
  TASK_STATUS_QUERY_KEY,
  type TaskStatusFilter,
} from "@/lib/dashboard-target-filter";
import { CREATION_ACTION_BUTTON_CLASS } from "@/lib/creation-action";
import { trpc } from "@/lib/trpc";
import { ArrowDownAZ, ArrowUpZA, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "wouter";

const temporaryId = () => -Date.now() - Math.floor(Math.random() * 1_000);

export default function TaskList({
  kind,
  title,
}: {
  kind: "prep" | "post";
  title: string;
}) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = parseTaskStatusFilter(
    searchParams.get(TASK_STATUS_QUERY_KEY)
  );
  const api = (trpc as any)[kind];
  const listUtils = (utils as any)[kind].list;
  const { data: rows = [], isLoading } = api.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const [task, setTask] = useState("");
  const [dueText, setDueText] = useState("");
  const [postCreateDialogOpen, setPostCreateDialogOpen] = useState(false);
  const [contactFilter, setContactFilter] = useState("alle");
  const [sortAsc, setSortAsc] = useState(true);
  const isPrep = kind === "prep";
  const emptyMessage =
    rows.length === 0
      ? "Noch keine Aufgaben."
      : statusFilter === "offen"
        ? "Keine offenen Aufgaben."
        : "Keine Aufgaben für die gewählten Filter.";

  const visibleRows = useMemo(
    () =>
      [...rows]
        .filter((row: any) => {
          if (statusFilter !== "alle" && row.status !== statusFilter)
            return false;
          if (contactFilter === "alle") return true;
          if (contactFilter === "ohne") return !row.contactId;
          return String(row.contactId ?? "") === contactFilter;
        })
        .sort((left: any, right: any) => {
          const comparison = String(left.task).localeCompare(
            String(right.task),
            "de",
            { sensitivity: "base" }
          );
          return sortAsc ? comparison : -comparison;
        }),
    [rows, contactFilter, statusFilter, sortAsc]
  );

  const updateStatusFilter = (value: TaskStatusFilter) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === "alle") next.delete(TASK_STATUS_QUERY_KEY);
        else next.set(TASK_STATUS_QUERY_KEY, value);
        return next;
      },
      { replace: true }
    );
  };

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
          task: input.task,
          dueText: input.dueText ?? "",
          contactId: input.contactId ?? null,
          status: "offen",
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
      setTask("");
      setDueText("");
      if (!isPrep) setPostCreateDialogOpen(false);
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
    onSuccess: () => toast.success("Entfernt"),
    onError: (error: any, _input: any, context: any) => {
      listUtils.setData(undefined, context?.previous);
      toast.error(error.message);
    },
    onSettled: refreshDashboard,
  });

  const submitCreate = () => {
    if (!task.trim() || create.isPending) return;
    create.mutate({
      task: task.trim(),
      ...(isPrep ? { dueText: dueText.trim() } : {}),
    });
  };

  const openPostCreateDialog = () => {
    setTask("");
    setPostCreateDialogOpen(true);
  };

  const closePostCreateDialog = () => {
    if (create.isPending) return;
    setPostCreateDialogOpen(false);
    setTask("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">
            Aufgaben mit Verantwortlichem und Status
            {isPrep ? " sowie frei formulierbarer Frist." : "."}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 max-lg:[&>[data-slot=button]]:h-11 max-lg:[&>[data-slot=button]]:text-base lg:[&>[data-slot=button]]:w-auto lg:[&>[data-slot=button]]:px-4">
          <ModuleExcelImportButton
            area={kind === "prep" ? "VORBEREITUNG" : "NACHBEREITUNG"}
            label={title}
          />
          <ResetAreaButton area={kind} label={title} compact />
          {isPrep ? (
            <>
              <Input
                placeholder="Neue Aufgabe"
                value={task}
                onChange={event => setTask(event.target.value)}
                className="col-span-2 w-full lg:order-last lg:w-72"
                onKeyDown={event => event.key === "Enter" && submitCreate()}
              />
              <Input
                placeholder="Zu erledigen bis (Freitext)"
                value={dueText}
                onChange={event => setDueText(event.target.value)}
                className="col-span-2 w-full lg:order-last lg:ml-2 lg:w-64"
                onKeyDown={event => event.key === "Enter" && submitCreate()}
              />
              <Button
                className="col-span-2 shadow-xs lg:col-auto"
                onClick={submitCreate}
                disabled={!task.trim() || create.isPending}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                <span>
                  {create.isPending ? "Speichert …" : "Neue Aufgabe"}
                </span>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className={`col-span-2 shadow-xs lg:col-auto ${CREATION_ACTION_BUTTON_CLASS}`}
              onClick={openPostCreateDialog}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              <span>Neue Aufgabe</span>
            </Button>
          )}
        </div>
      </div>
      {statusFilter !== "alle" && (
        <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div role="status" aria-live="polite">
            <p className="font-semibold">
              {statusFilter === "offen"
                ? "Nur offene Aufgaben"
                : statusFilter === "inArbeit"
                  ? "Nur Aufgaben in Arbeit"
                  : "Nur erledigte Aufgaben"}
            </p>
            <p className="text-sm text-blue-800">
              Die Aufgabenliste ist nach Status gefiltert.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-blue-300 bg-white text-blue-950 hover:bg-blue-100"
            onClick={() => updateStatusFilter("alle")}
          >
            Filter aufheben
          </Button>
        </div>
      )}
      <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full text-base md:h-10 md:w-auto md:text-sm"
          onClick={() => setSortAsc(value => !value)}
        >
          {sortAsc ? (
            <ArrowDownAZ className="mr-2 h-4 w-4" />
          ) : (
            <ArrowUpZA className="mr-2 h-4 w-4" />
          )}
          Aufgabe {sortAsc ? "A–Z" : "Z–A"}
        </Button>
        <Select
          value={statusFilter}
          onValueChange={value =>
            updateStatusFilter(value as TaskStatusFilter)
          }
        >
          <SelectTrigger
            className="h-11 w-full text-base md:h-10 md:w-[220px] md:text-sm"
            aria-label="Aufgabenstatus filtern"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            <SelectItem value="offen">Nur offen</SelectItem>
            <SelectItem value="inArbeit">Nur in Arbeit</SelectItem>
            <SelectItem value="erledigt">Nur erledigt</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contactFilter} onValueChange={setContactFilter}>
          <SelectTrigger className="h-11 w-full text-base md:h-10 md:w-[240px] md:text-sm">
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
        <span className="w-full text-sm text-muted-foreground md:w-auto">
          {visibleRows.length} von {rows.length} Einträgen
        </span>
      </div>
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
                  Aufgabe
                </span>
                <Input
                  className="h-11 w-full font-medium md:h-10"
                  defaultValue={row.task ?? ""}
                  onBlur={event => {
                    if (event.target.value !== (row.task ?? ""))
                      update.mutate({ id: row.id, task: event.target.value });
                  }}
                />
              </div>
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      <SelectItem value="offen">offen</SelectItem>
                      <SelectItem value="inArbeit">in Arbeit</SelectItem>
                      <SelectItem value="erledigt">erledigt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isPrep && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Zu erledigen bis
                    </span>
                    <Input
                      className="h-11 w-full md:h-10"
                      defaultValue={row.dueText ?? ""}
                      placeholder="Frist oder Zeitpunkt"
                      onBlur={event => {
                        if (event.target.value !== (row.dueText ?? ""))
                          update.mutate({
                            id: row.id,
                            dueText: event.target.value,
                          });
                      }}
                    />
                  </div>
                )}
              </div>
              {user?.role === "admin" && row.id > 0 && (
                <Button
                  variant="outline"
                  className="w-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: row.id })}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Aufgabe löschen
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && visibleRows.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-muted-foreground">
              {emptyMessage}
            </CardContent>
          </Card>
        )}
      </div>
      <Card className="hidden shadow-sm md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3">Aufgabe</th>
                <th className="p-3">Verantwortlich</th>
                <th className="p-3 text-center">Status</th>
                {isPrep && <th className="p-3">Zu erledigen bis</th>}
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    className="p-4 text-muted-foreground"
                    colSpan={isPrep ? 5 : 4}
                  >
                    Lade …
                  </td>
                </tr>
              )}
              {visibleRows.map((row: any) => (
                <tr key={row.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <Input
                      className="h-8 w-full min-w-[160px] font-medium"
                      defaultValue={row.task ?? ""}
                      onBlur={event => {
                        if (event.target.value !== (row.task ?? ""))
                          update.mutate({
                            id: row.id,
                            task: event.target.value,
                          });
                      }}
                    />
                  </td>
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
                      <SelectTrigger className="h-8 w-[180px]">
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
                          <SelectItem value="offen">offen</SelectItem>
                          <SelectItem value="inArbeit">in Arbeit</SelectItem>
                          <SelectItem value="erledigt">erledigt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                  {isPrep && (
                    <td className="p-2">
                      <Input
                        className="h-8 w-full min-w-[190px]"
                        defaultValue={row.dueText ?? ""}
                        placeholder="z. B. 15.05. oder vor Streckenfreigabe"
                        onBlur={event => {
                          if (event.target.value !== (row.dueText ?? ""))
                            update.mutate({
                              id: row.id,
                              dueText: event.target.value,
                            });
                        }}
                      />
                    </td>
                  )}
                  <td className="p-2">
                    {user?.role === "admin" && row.id > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Aufgabe ${row.task} löschen`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate({ id: row.id })}
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
                    colSpan={isPrep ? 5 : 4}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {!isPrep && (
        <Dialog
          open={postCreateDialogOpen}
          onOpenChange={open => {
            if (!open) closePostCreateDialog();
            else setPostCreateDialogOpen(true);
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] !bg-white !text-slate-950 shadow-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Neue Nachbereitungsaufgabe</DialogTitle>
            </DialogHeader>
            <form
              className="grid min-w-0 gap-3 py-2"
              onSubmit={event => {
                event.preventDefault();
                submitCreate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="post-create-task">
                  Aufgabe <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="post-create-task"
                  value={task}
                  autoFocus
                  required
                  placeholder="z. B. Abbaufläche kontrollieren"
                  onChange={event => setTask(event.target.value)}
                />
              </div>
              <DialogFooter className="mt-1 w-full min-w-0 flex-col gap-3 border-t pt-3 sm:flex-col sm:items-stretch">
                <div className="flex w-full flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={create.isPending}
                    onClick={closePostCreateDialog}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="submit"
                    disabled={!task.trim() || create.isPending}
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

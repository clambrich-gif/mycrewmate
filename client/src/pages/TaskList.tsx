import { useAuth } from "@/_core/hooks/useAuth";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
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
  const api = (trpc as any)[kind];
  const listUtils = (utils as any)[kind].list;
  const { data: rows = [], isLoading } = api.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const [task, setTask] = useState("");
  const [dueText, setDueText] = useState("");
  const [contactFilter, setContactFilter] = useState("alle");
  const [sortAsc, setSortAsc] = useState(true);
  const isPrep = kind === "prep";

  const visibleRows = useMemo(
    () =>
      [...rows]
        .filter((row: any) => {
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
    [rows, contactFilter, sortAsc]
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
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          <ModuleExcelImportButton
            area={kind === "prep" ? "VORBEREITUNG" : "NACHBEREITUNG"}
            label={title}
          />
          <ResetAreaButton area={kind} label={title} compact />
          <Input
            placeholder="Neue Aufgabe"
            value={task}
            onChange={event => setTask(event.target.value)}
            className="w-full sm:w-72"
            onKeyDown={event => event.key === "Enter" && submitCreate()}
          />
          {isPrep && (
            <Input
              placeholder="Zu erledigen bis (Freitext)"
              value={dueText}
              onChange={event => setDueText(event.target.value)}
              className="w-full sm:w-64"
              onKeyDown={event => event.key === "Enter" && submitCreate()}
            />
          )}
          <Button
            className="w-full sm:w-auto"
            onClick={submitCreate}
            disabled={!task.trim() || create.isPending}
          >
            {create.isPending ? "Speichert …" : "Hinzufügen"}
          </Button>
        </div>
      </div>
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
          Aufgabe {sortAsc ? "A–Z" : "Z–A"}
        </Button>
        <Select value={contactFilter} onValueChange={setContactFilter}>
          <SelectTrigger className="w-full sm:w-[240px]">
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
        <span className="text-sm text-muted-foreground">
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
                  className="h-10 w-full font-medium"
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
                  <SelectTrigger className="h-10 w-full">
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
                    <SelectTrigger className="h-10 w-full">
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
                      className="h-10 w-full"
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
                  className="w-full border-destructive/40 text-destructive"
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
              {rows.length === 0
                ? "Noch keine Aufgaben."
                : "Keine Aufgaben für diesen Verantwortlichen."}
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
                <th className="p-3">Status</th>
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
                        <SelectItem value="offen">offen</SelectItem>
                        <SelectItem value="inArbeit">in Arbeit</SelectItem>
                        <SelectItem value="erledigt">erledigt</SelectItem>
                      </SelectContent>
                    </Select>
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
                    {rows.length === 0
                      ? "Noch keine Aufgaben."
                      : "Keine Aufgaben für diesen Verantwortlichen."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

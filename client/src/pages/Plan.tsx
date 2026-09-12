import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CopyPreviousPlanButton } from "@/components/CopyPreviousPlanButton";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import { shiftsOverlap, type ShiftTimeLike } from "@shared/shift-time";
import { helperAvailableOnDay, WEEKDAYS, type Weekday } from "@shared/weekdays";

const formatTimeLabel = (shift: { startTime: string; endTime: string }) =>
  shift.startTime && shift.endTime
    ? `${shift.startTime}–${shift.endTime}`
    : "ganztägig";

type AssignmentT = {
  id: number;
  shiftId: number;
  helperId: number;
  slot: number;
};

type DropdownShift = ShiftTimeLike & {
  id: number;
  area: string;
  task: string;
  startTime: string;
  endTime: string;
};

export default function Plan() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const canEditPlan = user?.role === "admin";
  const { data: evals = [], isLoading } = trpc.plan.evaluate.useQuery();
  const { data: helpers = [] } = trpc.helpers.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: areaContactRows = [] } = trpc.plan.areaContacts.useQuery();
  const [day, setDay] = useState<string>("alle");
  const [area, setArea] = useState<string>("alle");
  const [status, setStatus] = useState<string>("alle");
  const [apFilter, setApFilter] = useState<string>("alle");
  const [q, setQ] = useState("");

  const invalidate = () => {
    utils.plan.evaluate.invalidate();
    utils.dashboard.stats.invalidate();
  };
  const assign = trpc.plan.assign.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const unassign = trpc.plan.unassign.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message),
  });
  const createShift = trpc.shifts.create.useMutation({
    onSuccess: () => {
      invalidate();
      setDlgOpen(false);
      toast.success("Schicht angelegt");
    },
    onError: e => toast.error(e.message),
  });
  const updateShift = trpc.shifts.update.useMutation({
    onSuccess: () => {
      invalidate();
      setDlgOpen(false);
      toast.success("Schicht aktualisiert");
    },
    onError: e => toast.error(e.message),
  });
  const deleteShift = trpc.shifts.remove.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Schicht gelöscht");
    },
    onError: e => toast.error(e.message),
  });
  const setAreaContact = trpc.plan.setAreaContact.useMutation({
    onSuccess: async () => {
      await utils.plan.areaContacts.invalidate();
      toast.success("Bereichsansprechpartner gespeichert");
    },
    onError: error => toast.error(error.message),
  });

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editShift, setEditShift] = useState<any | null>(null);
  const [form, setForm] = useState<{
    day: Weekday;
    area: string;
    task: string;
    startTime: string;
    endTime: string;
    needed: number;
    note: string;
  }>({
    day: "Freitag",
    area: "",
    task: "",
    startTime: "",
    endTime: "",
    needed: 1,
    note: "",
  });
  const openCreate = () => {
    setEditShift(null);
    setForm({
      day: "Freitag",
      area: "",
      task: "",
      startTime: "",
      endTime: "",
      needed: 1,
      note: "",
    });
    setDlgOpen(true);
  };
  const openEdit = (s: any) => {
    setEditShift(s);
    setForm({
      day: s.day,
      area: s.area,
      task: s.task,
      startTime: s.startTime,
      endTime: s.endTime,
      needed: s.needed,
      note: s.note ?? "",
    });
    setDlgOpen(true);
  };
  const saveShift = () => {
    if (!canEditPlan) return;
    if (!form.task.trim() || !form.area.trim()) {
      toast.error("Bereich und Aufgabe sind Pflicht");
      return;
    }
    if (
      (!form.startTime && form.endTime) ||
      (form.startTime && !form.endTime)
    ) {
      toast.error("Beginn und Ende müssen gemeinsam angegeben werden");
      return;
    }
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      toast.error("Das Ende muss nach dem Beginn liegen");
      return;
    }
    if (editShift) updateShift.mutate({ id: editShift.id, ...form });
    else createShift.mutate({ ...form });
  };

  const areas = useMemo(
    () => Array.from(new Set(evals.map(e => e.shift.area))),
    [evals]
  );
  const contactName = (id: number | null) =>
    contacts.find(c => c.id === id)?.name ?? "";
  const areaContactMap = useMemo(
    () => new Map(areaContactRows.map(item => [item.area, item.contactId])),
    [areaContactRows]
  );
  const label = (h: any) =>
    `${h.name}${h.contactId ? ` (${contactName(h.contactId)})` : ""}`;

  const filtered = useMemo(
    () =>
      evals
        .filter(
          e =>
            (day === "alle" || e.shift.day === day) &&
            (area === "alle" || e.shift.area === area) &&
            (status === "alle" || e.status === status) &&
            (!q ||
              e.shift.task.toLowerCase().includes(q.toLowerCase()) ||
              e.shift.area.toLowerCase().includes(q.toLowerCase())) &&
            (apFilter === "alle" ||
              String(areaContactMap.get(e.shift.area) ?? "") === apFilter)
        )
        .sort(
          (left, right) =>
            WEEKDAYS.indexOf(left.shift.day as Weekday) -
              WEEKDAYS.indexOf(right.shift.day as Weekday) ||
            left.shift.sortOrder - right.shift.sortOrder ||
            left.shift.startTime.localeCompare(right.shift.startTime) ||
            left.shift.id - right.shift.id
        ),
    [evals, day, area, status, q, apFilter, areaContactMap]
  );

  const activeHelpers = (d: string) =>
    helpers.filter(h => helperAvailableOnDay(h, d as Weekday));

  const assignedShiftsByHelper = useMemo(() => {
    const result = new Map<number, DropdownShift[]>();
    for (const evaluation of evals) {
      for (const assignment of evaluation.assigned as AssignmentT[]) {
        const assigned = result.get(assignment.helperId) ?? [];
        assigned.push(evaluation.shift);
        result.set(assignment.helperId, assigned);
      }
    }
    return result;
  }, [evals]);

  const overlappingAssignments = (
    helperId: number,
    currentShift: DropdownShift
  ) =>
    (assignedShiftsByHelper.get(helperId) ?? []).filter(
      other =>
        other.id !== currentShift.id && shiftsOverlap(other, currentShift)
    );

  // Slots: bis zu needed, max 20
  const slotsFor = (e: any): { slot: number; a: AssignmentT | undefined }[] => {
    const n = Math.min(Math.max(e.shift.needed, 0), 20);
    const bySlot = new Map<number, AssignmentT>(
      (e.assigned as AssignmentT[]).map(a => [a.slot, a])
    );
    return Array.from({ length: n }, (_, i) => ({ slot: i, a: bySlot.get(i) }));
  };

  const renderShiftSlots = (evalE: any) => {
    const shift = evalE.shift;
    const assignedHelperIds = new Set<number>(
      (evalE.assigned as AssignmentT[]).map(assignment => assignment.helperId)
    );
    const actives = activeHelpers(shift.day).filter(
      helper => !assignedHelperIds.has(helper.id)
    );
    return (
      <div className="flex flex-wrap gap-1.5">
        {slotsFor(evalE).map(({ slot, a }) => {
          if (!a) {
            if (!canEditPlan) {
              return (
                <span
                  key={slot}
                  className="slot slot-offen inline-flex h-9 items-center"
                >
                  Platz offen
                </span>
              );
            }
            return (
              <Select
                key={slot}
                disabled={assign.isPending}
                onValueChange={value =>
                  assign.mutate({
                    shiftId: shift.id,
                    helperId: Number(value),
                    slot,
                  })
                }
              >
                <SelectTrigger className="slot slot-offen h-9 w-full min-w-[180px] sm:w-[220px]">
                  <SelectValue placeholder="Helfer wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {actives.map(helper => {
                    const conflicts = overlappingAssignments(helper.id, shift);
                    const isAlreadyAssigned = conflicts.length > 0;
                    const conflictTitle = conflicts
                      .map(
                        other =>
                          `${other.area}: ${other.task} (${formatTimeLabel(other)})`
                      )
                      .join(", ");
                    return (
                      <SelectItem
                        key={helper.id}
                        value={String(helper.id)}
                        className={
                          isAlreadyAssigned
                            ? "bg-amber-100 text-amber-950 focus:bg-amber-200 focus:text-amber-950 dark:bg-amber-900/60 dark:text-amber-50 dark:focus:bg-amber-800"
                            : undefined
                        }
                        title={
                          isAlreadyAssigned
                            ? `Zeitgleich eingeteilt: ${conflictTitle}`
                            : undefined
                        }
                      >
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="truncate">{label(helper)}</span>
                          {isAlreadyAssigned && (
                            <span className="shrink-0 rounded-full border border-amber-500 bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-950 dark:bg-amber-800 dark:text-amber-50">
                              bereits belegt
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                  {actives.length === 0 && (
                    <SelectItem value="x" disabled>
                      Keine verfügbaren Helfer
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            );
          }
          const helper =
            evalE.validHelpers.find((item: any) => item.id === a.helperId) ??
            evalE.ausfallHelpers.find((item: any) => item.id === a.helperId);
          const isAusfall = evalE.ausfallHelpers.some(
            (item: any) => item.id === a.helperId
          );
          const isDoppel =
            !isAusfall && (evalE.doppelIds as Set<number>).has(a.helperId);
          const className = isAusfall
            ? "slot-ausfall"
            : isDoppel
              ? "slot-doppel"
              : "slot-ok";
          return (
            <span
              key={slot}
              className={`slot ${className} inline-flex items-center justify-between gap-1`}
            >
              <span className="truncate">{helper ? label(helper) : "?"}</span>
              {canEditPlan && (
                <button
                  className="opacity-60 hover:opacity-100"
                  title="Entfernen"
                  onClick={() => unassign.mutate({ id: a.id })}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        {shift.needed === 0 && (
          <span className="slot slot-gesperrt">Kein Bedarf</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Einsatzplan</h1>
        <p className="text-muted-foreground">
          {canEditPlan
            ? "Nur verfügbare, aktive Helfer sind auswählbar. Zeitgleich bereits eingeteilte Helfer sind im Auswahlmenü gelb markiert, bleiben aber auswählbar. Absagen markieren Ausfälle (rot), Doppelbelegungen werden gewarnt (orange)."
            : "Das Planungsteam kann den Einsatzplan vollständig ansehen und filtern. Änderungen und Helferzuweisungen sind Administratoren vorbehalten."}
        </p>
      </div>
      {canEditPlan && (
        <div className="flex justify-end gap-2 flex-wrap">
          <ModuleExcelImportButton area="EINSATZPLAN" label="Einsatzplan" />
          <CopyPreviousPlanButton />
          <ResetAreaButton area="shifts" label="Einsatzplan" />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Schicht
          </Button>
        </div>
      )}

      {areas.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3">
              <h2 className="font-semibold">Ansprechpartner je Bereich</h2>
              <p className="text-sm text-muted-foreground">
                Die Zuordnung gilt für alle Schichten des Bereichs und steht
                außerdem als PDF-Filter zur Verfügung.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map(areaName => {
                const selected = areaContactMap.get(areaName) ?? null;
                return (
                  <div
                    key={areaName}
                    className="rounded-lg border bg-muted/20 p-3"
                  >
                    <Label className="mb-1.5 block truncate" title={areaName}>
                      {areaName}
                    </Label>
                    {canEditPlan ? (
                      <Select
                        value={selected ? String(selected) : "none"}
                        onValueChange={value =>
                          setAreaContact.mutate({
                            area: areaName,
                            contactId: value === "none" ? null : Number(value),
                          })
                        }
                      >
                        <SelectTrigger
                          className={
                            selected
                              ? "w-full bg-white dark:bg-slate-950"
                              : "w-full border-amber-400 bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50"
                          }
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
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
                    ) : (
                      <div
                        className={`rounded-md border px-3 py-2 text-sm ${selected ? "bg-background" : "border-amber-400 bg-amber-100 text-amber-950"}`}
                      >
                        {selected
                          ? contactName(selected)
                          : "Kein Ansprechpartner"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
        <Input
          placeholder="Suchen (Aufgabe/Bereich) …"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full lg:w-60"
        />
        <Select value={day} onValueChange={setDay}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Tage</SelectItem>
            {WEEKDAYS.map(d => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-full lg:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Bereiche</SelectItem>
            {areas.map(a => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            <SelectItem value="OFFEN">OFFEN</SelectItem>
            <SelectItem value="KNAPP">KNAPP</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
          </SelectContent>
        </Select>
        <Select value={apFilter} onValueChange={setApFilter}>
          <SelectTrigger className="w-full lg:w-52">
            <SelectValue placeholder="Ansprechpartner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Ansprechpartner</SelectItem>
            {contacts.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.map(e => {
          const shift = e.shift;
          return (
            <Card key={shift.id} className="shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{shift.day}</span>
                      <StatusBadge status={e.status} />
                    </div>
                    <h2 className="break-words text-lg font-semibold">
                      {shift.task}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {shift.area} · {formatTimeLabel(shift)}
                    </p>
                  </div>
                  {canEditPlan && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        title="Schicht bearbeiten"
                        onClick={() => openEdit(shift)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Schicht löschen"
                        onClick={() => {
                          if (confirm("Schicht wirklich löschen?"))
                            deleteShift.mutate({ id: shift.id });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Bedarf</dt>
                    <dd className="font-semibold">
                      {e.besetzt} von {shift.needed} besetzt
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Ansprechpartner
                    </dt>
                    <dd className="font-medium">
                      {contactName(areaContactMap.get(shift.area) ?? null) ||
                        "nicht zugeordnet"}
                    </dd>
                  </div>
                </dl>
                {shift.note?.trim() && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <span className="font-medium">Bemerkung:</span> {shift.note}
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Eingeteilte Helfer
                  </p>
                  {renderShiftSlots(e)}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Keine Schichten gefunden.
          </div>
        )}
      </div>

      <Card className="hidden shadow-sm md:block">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[1500px]">
            <thead className="bg-muted/60 sticky top-0">
              <tr className="text-left">
                <th className="p-3">Tag</th>
                <th className="p-3">Bereich</th>
                <th className="p-3">Ansprechpartner</th>
                <th className="p-3">Aufgabe</th>
                <th className="p-3">Bemerkung</th>
                <th className="p-3">Zeit</th>
                <th className="p-3">Bedarf</th>
                <th className="p-3">Besetzt</th>
                <th className="p-3">Status</th>
                <th className="p-3">Doppel</th>
                <th className="p-3">Ausfall</th>
                <th className="p-3">Eingeteilte Helfer (Anzahl = Bedarf)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={12}>
                    Lade …
                  </td>
                </tr>
              )}
              {filtered.map(e => {
                const s = e.shift;
                const evalE = e as typeof e & { assigned: AssignmentT[] };
                return (
                  <tr
                    key={s.id}
                    className="border-t align-top hover:bg-muted/20"
                  >
                    <td className="p-3 font-medium">{s.day}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span>{s.area}</span>
                        {canEditPlan && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Schicht bearbeiten"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canEditPlan && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Löschen"
                            onClick={() => {
                              if (confirm("Schicht wirklich löschen?"))
                                deleteShift.mutate({ id: s.id });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {contactName(areaContactMap.get(s.area) ?? null) || (
                        <span className="text-amber-700">nicht zugeordnet</span>
                      )}
                    </td>
                    <td className="p-3">{s.task}</td>
                    <td className="max-w-64 whitespace-pre-wrap p-3 text-muted-foreground">
                      {s.note?.trim() || "–"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {s.startTime && s.endTime
                        ? `${s.startTime}–${s.endTime}`
                        : "ganztägig"}
                    </td>
                    <td className="p-3 font-semibold">{s.needed}</td>
                    <td className="p-3">{e.besetzt}</td>
                    <td className="p-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="p-3">
                      {e.doppelCount > 0 ? (
                        <span className="badge badge-warn">
                          {e.doppelCount}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="p-3">
                      {e.ausfallCount > 0 ? (
                        <span className="badge badge-err">
                          {e.ausfallCount}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="p-3">{renderShiftSlots(evalE)}</td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={12}>
                    Keine Schichten gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Legende: <span className="slot slot-offen inline-block">offen</span>{" "}
        <span className="inline-block rounded border border-amber-400 bg-amber-100 px-2 py-0.5 text-amber-950">
          im Dropdown bereits belegt
        </span>{" "}
        <span className="slot slot-doppel inline-block">Doppelbelegung</span>{" "}
        <span className="slot slot-ausfall inline-block">Ausfall</span>
      </p>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto !bg-white !text-slate-950 opacity-100 shadow-2xl dark:!bg-slate-950 dark:!text-slate-50 [&_[data-slot=input]]:!bg-white [&_[data-slot=input]]:dark:!bg-slate-900 [&_[data-slot=select-trigger]]:!bg-white [&_[data-slot=select-trigger]]:dark:!bg-slate-900">
          <DialogHeader>
            <DialogTitle>
              {editShift ? "Schicht bearbeiten" : "Neue Schicht"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tag</Label>
                <Select
                  value={form.day}
                  onValueChange={v => setForm({ ...form, day: v as Weekday })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map(d => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bedarf</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={form.needed}
                  onChange={e =>
                    setForm({
                      ...form,
                      needed: Math.max(
                        0,
                        Math.min(20, Number(e.target.value) || 0)
                      ),
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Bereich</Label>
              <Input
                value={form.area}
                onChange={e => setForm({ ...form, area: e.target.value })}
                placeholder="z. B. Essen & Getränke"
              />
            </div>
            <div>
              <Label>Aufgabe / Schicht</Label>
              <Input
                value={form.task}
                onChange={e => setForm({ ...form, task: e.target.value })}
                placeholder="z. B. Grill & Pommes Tag"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Beginn</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={e =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Ende</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={e => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Für eine ganztägige Schicht beide Uhrzeitfelder leer lassen.
            </p>
            <div>
              <Label>Bemerkung</Label>
              <Input
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="z. B. Treffpunkt, Kleidung oder Besonderheiten"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>
              <X className="h-4 w-4 mr-1" />
              Abbrechen
            </Button>
            <Button
              onClick={saveShift}
              disabled={createShift.isPending || updateShift.isPending}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

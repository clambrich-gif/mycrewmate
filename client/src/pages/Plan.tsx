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

const DAYS = ["Freitag", "Samstag", "Sonntag"] as const;

type AssignmentT = {
  id: number;
  shiftId: number;
  helperId: number;
  slot: number;
};

export default function Plan() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: evals = [], isLoading } = trpc.plan.evaluate.useQuery();
  const { data: helpers = [] } = trpc.helpers.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
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

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editShift, setEditShift] = useState<any | null>(null);
  const [form, setForm] = useState<{
    day: (typeof DAYS)[number];
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
  const label = (h: any) =>
    `${h.name}${h.contactId ? ` (${contactName(h.contactId)})` : ""}`;

  const filtered = useMemo(
    () =>
      evals.filter(
        e =>
          (day === "alle" || e.shift.day === day) &&
          (area === "alle" || e.shift.area === area) &&
          (status === "alle" || e.status === status) &&
          (!q ||
            e.shift.task.toLowerCase().includes(q.toLowerCase()) ||
            e.shift.area.toLowerCase().includes(q.toLowerCase())) &&
          (apFilter === "alle" ||
            e.validHelpers.some(h => String(h.contactId ?? "") === apFilter))
      ),
    [evals, day, area, status, q, apFilter]
  );

  const activeHelpers = (d: string) =>
    helpers.filter(
      h =>
        h.willHelp === "ja" &&
        (d === "Freitag"
          ? h.availFri === "ja"
          : d === "Samstag"
            ? h.availSat === "ja"
            : h.availSun === "ja")
    );

  // Slots: bis zu needed, max 20
  const slotsFor = (e: any): { slot: number; a: AssignmentT | undefined }[] => {
    const n = Math.min(Math.max(e.shift.needed, 0), 20);
    const bySlot = new Map<number, AssignmentT>(
      (e.assigned as AssignmentT[]).map(a => [a.slot, a])
    );
    return Array.from({ length: n }, (_, i) => ({ slot: i, a: bySlot.get(i) }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Einsatzplan</h1>
        <p className="text-muted-foreground">
          Nur verfügbare, aktive Helfer sind auswählbar. Absagen markieren
          Ausfälle (rot), Doppelbelegungen werden gewarnt (orange).
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Schicht
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Suchen (Aufgabe/Bereich) …"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-60"
        />
        <Select value={day} onValueChange={setDay}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Tage</SelectItem>
            {DAYS.map(d => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-52">
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
          <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-52">
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

      <Card className="shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-muted/60 sticky top-0">
              <tr className="text-left">
                <th className="p-3">Tag</th>
                <th className="p-3">Bereich</th>
                <th className="p-3">Aufgabe</th>
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
                  <td className="p-4 text-muted-foreground" colSpan={10}>
                    Lade …
                  </td>
                </tr>
              )}
              {filtered.map(e => {
                const s = e.shift;
                const evalE = e as typeof e & { assigned: AssignmentT[] };
                const assignedHelperIds = new Set(
                  evalE.assigned.map(assignment => assignment.helperId)
                );
                const actives = activeHelpers(s.day).filter(
                  helper => !assignedHelperIds.has(helper.id)
                );
                return (
                  <tr
                    key={s.id}
                    className="border-t align-top hover:bg-muted/20"
                  >
                    <td className="p-3 font-medium">{s.day}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span>{s.area}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Schicht bearbeiten"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {user?.role === "admin" && (
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
                    <td className="p-3">{s.task}</td>
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
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {slotsFor(evalE).map(({ slot, a }) => {
                          if (!a) {
                            return (
                              <Select
                                key={slot}
                                disabled={assign.isPending}
                                onValueChange={v =>
                                  assign.mutate({
                                    shiftId: s.id,
                                    helperId: Number(v),
                                    slot,
                                  })
                                }
                              >
                                <SelectTrigger className="slot slot-offen h-9 w-[180px]">
                                  <SelectValue placeholder="Helfer wählen …" />
                                </SelectTrigger>
                                <SelectContent>
                                  {actives.map(h => (
                                    <SelectItem key={h.id} value={String(h.id)}>
                                      {label(h)}
                                    </SelectItem>
                                  ))}
                                  {actives.length === 0 && (
                                    <SelectItem value="x" disabled>
                                      Keine verfügbaren Helfer
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            );
                          }
                          const h =
                            evalE.validHelpers.find(
                              (x: any) => x.id === a.helperId
                            ) ??
                            evalE.ausfallHelpers.find(
                              (x: any) => x.id === a.helperId
                            );
                          const isAusfall = evalE.ausfallHelpers.some(
                            (x: any) => x.id === a.helperId
                          );
                          const isDoppel =
                            !isAusfall &&
                            (evalE.doppelIds as Set<number>).has(a.helperId);
                          const cls = isAusfall
                            ? "slot-ausfall"
                            : isDoppel
                              ? "slot-doppel"
                              : "slot-ok";
                          return (
                            <span
                              key={slot}
                              className={`slot ${cls} inline-flex items-center justify-between gap-1`}
                            >
                              <span className="truncate">
                                {h ? label(h) : "?"}
                              </span>
                              <button
                                className="opacity-60 hover:opacity-100"
                                title="Entfernen"
                                onClick={() => unassign.mutate({ id: a.id })}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                        {e.shift.needed === 0 && (
                          <span className="slot slot-gesperrt">
                            Kein Bedarf
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={10}>
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
        <span className="slot slot-doppel inline-block">Doppelbelegung</span>{" "}
        <span className="slot slot-ausfall inline-block">Ausfall</span>
      </p>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editShift ? "Schicht bearbeiten" : "Neue Schicht"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tag</Label>
                <Select
                  value={form.day}
                  onValueChange={v =>
                    setForm({ ...form, day: v as (typeof DAYS)[number] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => (
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
            <div className="grid grid-cols-2 gap-3">
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

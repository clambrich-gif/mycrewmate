import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventYear } from "@/contexts/YearContext";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  RefreshCw,
  Upload,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ExcelImportPreview } from "../../../server/import-preview";

export default function Excel() {
  const { user } = useAuth();
  const { year } = useEventYear();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [base64, setBase64] = useState("");
  const [preview, setPreview] = useState<ExcelImportPreview | null>(null);
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(
    new Set()
  );
  const [activeHelpers, setActiveHelpers] = useState<Set<string>>(new Set());
  const [helperTargets, setHelperTargets] = useState<Record<string, string>>(
    {}
  );

  const previewMut = trpc.excel.previewFile.useMutation({
    onSuccess: result => {
      setPreview(result);
      setSelectedShifts(
        new Set(
          result.shifts
            .filter(item => item.status === "new" || item.status === "changed")
            .map(item => item.key)
        )
      );
      setSelectedAssignments(
        new Set(
          result.shifts.flatMap(item =>
            item.assignments.map(change => change.key)
          )
        )
      );
      setActiveHelpers(new Set());
      setHelperTargets(
        Object.fromEntries(
          result.helperSuggestions.map(item => [item.key, item.defaultTarget])
        )
      );
      toast.success(
        "Excel-Datei analysiert – Änderungen können jetzt geprüft werden"
      );
    },
    onError: error => toast.error(error.message),
  });

  const applyMut = trpc.excel.applyFile.useMutation({
    onSuccess: result => {
      const plan = result.plan;
      toast.success(
        `${plan.shiftsCreated} neue und ${plan.shiftsUpdated} geänderte Schichten, ${plan.assignmentsApplied} Helferzuordnungen übernommen`
      );
      if (plan.warnings.length)
        toast.warning(
          `${plan.warnings.length} Vorschläge konnten nicht übernommen werden`
        );
      clearPreview();
    },
    onError: error => toast.error(error.message),
  });

  const exportQ = trpc.excel.exportFile.useQuery(undefined, { enabled: false });

  const clearPreview = () => {
    setFilename("");
    setBase64("");
    setPreview(null);
    setSelectedShifts(new Set());
    setSelectedAssignments(new Set());
    setActiveHelpers(new Set());
    setHelperTargets({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(index, index + 0x8000))
      );
    }
    const encoded = btoa(binary);
    setFilename(file.name);
    setBase64(encoded);
    previewMut.mutate({ base64: encoded });
  };

  const onApply = () => {
    if (!base64) return;
    applyMut.mutate({
      base64,
      selectedShiftKeys: Array.from(selectedShifts),
      selectedAssignmentKeys: Array.from(selectedAssignments),
      helperDecisions: preview
        ? preview.helperSuggestions.map(item => ({
            key: item.key,
            target: activeHelpers.has(item.key)
              ? (helperTargets[item.key] ?? item.defaultTarget)
              : "skip",
          }))
        : [],
    });
  };

  const unresolvedHelperCount = preview
    ? new Set(
        preview.shifts
          .filter(
            shift => shift.existingShiftId || selectedShifts.has(shift.key)
          )
          .flatMap(shift =>
            shift.assignments
              .filter(
                assignment =>
                  selectedAssignments.has(assignment.key) &&
                  assignment.helperKey !== null &&
                  preview.helperSuggestions.some(
                    helper => helper.key === assignment.helperKey
                  ) &&
                  !activeHelpers.has(assignment.helperKey!)
              )
              .map(assignment => assignment.helperKey!)
          )
      ).size
    : 0;

  const onExport = async () => {
    const { data } = await exportQ.refetch();
    if (!data) return;
    const binary = Uint8Array.from(atob(data.base64), character =>
      character.charCodeAt(0)
    );
    const blob = new Blob([binary], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `MyEifelRide_Planung_${year}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string,
    checked: boolean
  ) =>
    setter(current => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Excel Import / Export</h1>
        <p className="text-muted-foreground">
          Import und Export beziehen sich ausschließlich auf das gewählte
          Veranstaltungsjahr {year}.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck2 className="h-5 w-5" /> Import mit Korrekturprüfung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Die Datei wird zunächst nur analysiert. Neue oder abweichende
            Schichten, Helfer und Zuordnungen werden markiert und erst mit dem
            abschließenden Bestätigen gespeichert. Bereits identische Daten
            werden nicht doppelt angelegt.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                previewMut.isPending ||
                applyMut.isPending ||
                user?.role !== "admin"
              }
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {previewMut.isPending ? "Analysiere …" : "Excel-Datei auswählen"}
            </Button>
            {preview && (
              <Button variant="outline" onClick={clearPreview}>
                <RefreshCw className="mr-2 h-4 w-4" /> Andere Datei wählen
              </Button>
            )}
          </div>
          {filename && (
            <p className="text-sm font-medium">Prüfdatei: {filename}</p>
          )}
          {user?.role !== "admin" && (
            <p className="text-xs text-muted-foreground">
              Nur Administratoren können Excel-Dateien importieren.
            </p>
          )}
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Neue Schichten"
              value={preview.totals.newShifts}
              tone="green"
            />
            <SummaryCard
              label="Geänderte Schichten"
              value={preview.totals.changedShifts}
              tone="amber"
            />
            <SummaryCard
              label="Zuordnungsänderungen"
              value={preview.totals.assignmentChanges}
              tone="blue"
            />
            <SummaryCard
              label="Helferabgleiche"
              value={preview.helperSuggestions.length}
              tone="violet"
            />
          </div>

          {preview.helperSuggestions.length > 0 && (
            <Card className="border-violet-300 bg-violet-50/80 shadow-sm dark:bg-violet-950/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UsersRound className="h-5 w-5 text-violet-700" />
                  Helferregister abgleichen
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ähnliche Namen werden nicht automatisch doppelt angelegt.
                  Prüfen Sie den vorgeschlagenen Treffer oder wählen Sie bewusst
                  „neu anlegen“.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {preview.helperSuggestions.map(item => (
                  <div
                    key={item.key}
                    className="grid gap-3 rounded-lg border border-violet-200 bg-white p-3 md:grid-cols-[auto_1fr_1.5fr] md:items-center dark:bg-slate-950"
                  >
                    <Checkbox
                      checked={activeHelpers.has(item.key)}
                      onCheckedChange={value =>
                        toggle(setActiveHelpers, item.key, value === true)
                      }
                      aria-label={`${item.importedName} übernehmen`}
                    />
                    <div>
                      <div className="font-semibold">{item.importedName}</div>
                      <Badge variant="outline" className="mt-1">
                        {item.status === "similar"
                          ? "Ähnlicher Name gefunden"
                          : item.status === "fromHelperSheet"
                            ? "In Helferdatei gefunden"
                            : "Noch nicht im Register"}
                      </Badge>
                    </div>
                    <Select
                      value={helperTargets[item.key] ?? item.defaultTarget}
                      onValueChange={value =>
                        setHelperTargets(current => ({
                          ...current,
                          [item.key]: value,
                        }))
                      }
                      disabled={!activeHelpers.has(item.key)}
                    >
                      <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {item.candidates.map(candidate => (
                          <SelectItem key={candidate.key} value={candidate.key}>
                            {candidate.label} –{" "}
                            {Math.round(candidate.score * 100)} % ähnlich
                          </SelectItem>
                        ))}
                        {item.status === "fromHelperSheet" &&
                          !item.candidates.some(
                            candidate => candidate.key === item.defaultTarget
                          ) && (
                            <SelectItem value={item.defaultTarget}>
                              {item.importedName} aus Helferdatei verwenden
                            </SelectItem>
                          )}
                        <SelectItem value="new">
                          {item.importedName} als neuen Helfer anlegen
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Einsatzplan prüfen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Grün = neue Schicht, Gelb = geänderte Daten, Blau = neue
                Zuordnung, Rot = bestehende Zuordnung wird ersetzt oder
                entfernt, Violett = mehrdeutiger Konflikt.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview.shifts.map(shift => {
                const selected = selectedShifts.has(shift.key);
                const rowClass =
                  shift.status === "new"
                    ? "border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/25"
                    : shift.status === "changed"
                      ? "border-amber-300 bg-amber-50/80 dark:bg-amber-950/25"
                      : shift.status === "conflict"
                        ? "border-violet-400 bg-violet-50/90 dark:bg-violet-950/30"
                        : "border-border bg-muted/20";
                return (
                  <div
                    key={shift.key}
                    className={`rounded-xl border p-4 ${rowClass}`}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <Checkbox
                        checked={
                          shift.status === "unchanged" ||
                          shift.status === "conflict"
                            ? false
                            : selected
                        }
                        disabled={
                          shift.status === "unchanged" ||
                          shift.status === "conflict"
                        }
                        onCheckedChange={value =>
                          toggle(setSelectedShifts, shift.key, value === true)
                        }
                        aria-label={`Schicht ${shift.values.task} übernehmen`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>
                            {shift.values.day} · {shift.values.area} ·{" "}
                            {shift.values.task}
                          </strong>
                          <Badge
                            className={
                              shift.status === "new"
                                ? "bg-emerald-600"
                                : shift.status === "changed"
                                  ? "bg-amber-600"
                                  : shift.status === "conflict"
                                    ? "bg-violet-700"
                                    : "bg-slate-500"
                            }
                          >
                            {shift.status === "new"
                              ? "NEU"
                              : shift.status === "changed"
                                ? "GEÄNDERT"
                                : shift.status === "conflict"
                                  ? "KONFLIKT"
                                  : "IDENTISCH"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Excel-Zeile {shift.rowNumber}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
                          <span>
                            Zeit: {shift.values.startTime || "ganztägig"}
                            {shift.values.endTime
                              ? `–${shift.values.endTime}`
                              : ""}
                          </span>
                          <span>Bedarf: {shift.values.needed}</span>
                          <span>Hinweis: {shift.values.note || "—"}</span>
                        </div>
                        {shift.status === "changed" && shift.current && (
                          <div className="mt-2 rounded-md border border-amber-200 bg-white/90 p-2 text-xs dark:bg-slate-950">
                            Bisher: {shift.current.startTime || "ganztägig"}
                            {shift.current.endTime
                              ? `–${shift.current.endTime}`
                              : ""}
                            , Bedarf {shift.current.needed}, Hinweis{" "}
                            {shift.current.note || "—"}
                          </div>
                        )}
                        {shift.status === "conflict" && (
                          <div className="mt-2 rounded-md border border-violet-300 bg-white/95 p-3 text-sm font-medium text-violet-900 dark:bg-slate-950 dark:text-violet-200">
                            {shift.conflictReason}
                          </div>
                        )}
                      </div>
                    </div>

                    {shift.assignments.length > 0 && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        {shift.assignments.map(assignment => {
                          const assignmentSelected = selectedAssignments.has(
                            assignment.key
                          );
                          const disabled =
                            (shift.status === "new" ||
                              shift.status === "changed") &&
                            !selected;
                          return (
                            <label
                              key={assignment.key}
                              className={`flex items-center gap-3 rounded-md border p-2 text-sm ${
                                assignment.kind === "replace" ||
                                assignment.kind === "remove"
                                  ? "border-red-300 bg-red-50 dark:bg-red-950/25"
                                  : "border-sky-300 bg-sky-50 dark:bg-sky-950/25"
                              }`}
                            >
                              <Checkbox
                                checked={!disabled && assignmentSelected}
                                disabled={disabled}
                                onCheckedChange={value =>
                                  toggle(
                                    setSelectedAssignments,
                                    assignment.key,
                                    value === true
                                  )
                                }
                              />
                              <span className="font-medium">
                                Platz {assignment.slot + 1}
                              </span>
                              {assignment.kind === "replace" ||
                              assignment.kind === "remove" ? (
                                <span>
                                  <span className="line-through text-muted-foreground">
                                    {assignment.currentHelperName ??
                                      "Unbekannt"}
                                  </span>{" "}
                                  → <strong>{assignment.importedName}</strong>
                                </span>
                              ) : (
                                <span>
                                  Neu zuordnen:{" "}
                                  <strong>{assignment.importedName}</strong>
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {preview.shifts.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Die Datei enthält kein lesbares Blatt „EINSATZPLAN“. Andere
                  unterstützte Tabellenblätter können trotzdem importiert
                  werden.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-primary" /> Auswahl
                  endgültig übernehmen
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Erst dieser Klick speichert die markierten Planänderungen und
                  die übrigen unterstützten Excel-Blätter in Planung {year}.
                </p>
                {unresolvedHelperCount > 0 && (
                  <p className="mt-2 text-sm font-semibold text-amber-700">
                    Bitte noch {unresolvedHelperCount} markierte Helferabgleiche
                    per Checkbox bestätigen oder die zugehörige Zuordnung
                    abwählen.
                  </p>
                )}
              </div>
              <Button
                size="lg"
                onClick={onApply}
                disabled={applyMut.isPending || unresolvedHelperCount > 0}
              >
                {applyMut.isPending
                  ? "Wird übernommen …"
                  : "Auswahl bestätigen & importieren"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Exportiert alle Planungsdaten einschließlich Einsatzplan als
            Excel-Datei.
          </p>
          <Button variant="outline" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" /> Als Excel exportieren
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "blue" | "violet";
}) {
  const colors = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  };
  const Icon =
    tone === "violet"
      ? UserPlus
      : tone === "amber"
        ? AlertTriangle
        : FileCheck2;
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

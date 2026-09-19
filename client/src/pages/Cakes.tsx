import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
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
import { Textarea } from "@/components/ui/textarea";
import { CREATION_ACTION_BUTTON_CLASS } from "@/lib/creation-action";
import { trpc } from "@/lib/trpc";
import { Cake, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "wouter";

type CakeRow = {
  id: number;
  donor: string;
  cake: string;
  dropoffTime: string;
  vegan: boolean;
  glutenFree: boolean;
  lactoseFree: boolean;
  containsNuts: boolean;
  note: string | null;
};

type CakeForm = Omit<CakeRow, "id" | "note"> & { note: string };

const EMPTY_CAKE_FORM: CakeForm = {
  donor: "",
  cake: "",
  dropoffTime: "",
  vegan: false,
  glutenFree: false,
  lactoseFree: false,
  containsNuts: false,
  note: "",
};

const traits = [
  {
    key: "vegan",
    label: "🌱 Vegan",
    tagClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    activeClass: "border-emerald-400 bg-emerald-100 text-emerald-900",
  },
  {
    key: "glutenFree",
    label: "🌾 Glutenfrei",
    tagClass: "border-amber-200 bg-amber-50 text-amber-900",
    activeClass: "border-amber-400 bg-amber-100 text-amber-950",
  },
  {
    key: "lactoseFree",
    label: "🥛 Laktosefrei",
    tagClass: "border-sky-200 bg-sky-50 text-sky-800",
    activeClass: "border-sky-400 bg-sky-100 text-sky-950",
  },
  {
    key: "containsNuts",
    label: "🌰 Enthält Nüsse",
    tagClass: "border-orange-200 bg-orange-50 text-orange-900",
    activeClass: "border-orange-400 bg-orange-100 text-orange-950",
  },
] as const;

type TraitKey = (typeof traits)[number]["key"];

function TraitTags({ row }: { row: CakeRow }) {
  const selectedTraits = traits.filter(trait => row[trait.key]);
  const note = row.note?.trim();

  if (!selectedTraits.length && !note)
    return <span className="text-sm text-slate-400">–</span>;

  return (
    <div className="space-y-1.5">
      {selectedTraits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTraits.map(trait => (
            <span
              key={trait.key}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${trait.tagClass}`}
            >
              {trait.label}
            </span>
          ))}
        </div>
      )}
      {note && <p className="text-xs leading-5 text-slate-600">{note}</p>}
    </div>
  );
}

export default function Cakes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDonor = searchParams.get("donor")?.trim() ?? "";
  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.cakes.list.useQuery();
  const { data: helpers = [] } = trpc.helpers.list.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCake, setEditingCake] = useState<CakeRow | null>(null);
  const [form, setForm] = useState<CakeForm>(EMPTY_CAKE_FORM);
  const [deleteTarget, setDeleteTarget] = useState<CakeRow | null>(null);
  const donorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          helpers
            .map(helper => helper.name.trim())
            .filter((name): name is string => Boolean(name))
        )
      ).sort((left, right) => left.localeCompare(right, "de-DE")),
    [helpers]
  );

  useEffect(() => {
    if (!requestedDonor) return;
    setEditingCake(null);
    setForm({ ...EMPTY_CAKE_FORM, donor: requestedDonor });
    setDialogOpen(true);
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.delete("donor");
        return next;
      },
      { replace: true }
    );
  }, [requestedDonor, setSearchParams]);

  const refresh = () => {
    void utils.cakes.list.invalidate();
    void utils.dashboard.stats.invalidate();
  };

  const createCake = trpc.cakes.create.useMutation({
    onSuccess: () => {
      toast.success("Kuchenspende erfasst");
      setDialogOpen(false);
      setForm(EMPTY_CAKE_FORM);
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  const updateCake = trpc.cakes.update.useMutation({
    onSuccess: () => {
      toast.success("Kuchenspende gespeichert");
      setEditingCake(null);
      setDialogOpen(false);
      setForm(EMPTY_CAKE_FORM);
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  const deleteCake = trpc.cakes.remove.useMutation({
    onSuccess: () => {
      toast.success("Kuchenspende entfernt");
      setDeleteTarget(null);
      refresh();
    },
    onError: error => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingCake(null);
    setForm(EMPTY_CAKE_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: CakeRow) => {
    setEditingCake(row);
    setForm({
      donor: row.donor,
      cake: row.cake,
      dropoffTime: row.dropoffTime,
      vegan: row.vegan,
      glutenFree: row.glutenFree,
      lactoseFree: row.lactoseFree,
      containsNuts: row.containsNuts,
      note: row.note ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (createCake.isPending || updateCake.isPending) return;
    setDialogOpen(false);
    setEditingCake(null);
    setForm(EMPTY_CAKE_FORM);
  };

  const submit = () => {
    if (!form.donor.trim()) return;
    const values = {
      donor: form.donor.trim(),
      cake: form.cake.trim(),
      dropoffTime: form.dropoffTime.trim(),
      vegan: form.vegan,
      glutenFree: form.glutenFree,
      lactoseFree: form.lactoseFree,
      containsNuts: form.containsNuts,
      note: form.note.trim() || null,
    };
    if (editingCake) updateCake.mutate({ id: editingCake.id, ...values });
    else createCake.mutate({ ...values, note: values.note ?? undefined });
  };

  const toggleTrait = (key: TraitKey) =>
    setForm(current => ({ ...current, [key]: !current[key] }));

  const busy = createCake.isPending || updateCake.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kuchen</h1>
          <p className="mt-1 text-sm text-slate-600">
            Spenden schnell erfassen und wichtige Hinweise sichtbar kennzeichnen.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 max-lg:[&>[data-slot=button]]:h-11 max-lg:[&>[data-slot=button]]:text-base lg:[&>[data-slot=button]]:w-auto lg:[&>[data-slot=button]]:px-4">
          <Button
            type="button"
            variant="outline"
            className="col-span-2 shadow-xs lg:col-auto"
            onClick={openCreate}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Kuchen erfassen
          </Button>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Lade …
            </CardContent>
          </Card>
        )}
        {(rows as CakeRow[]).map(row => (
          <Card key={row.id} className="shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Spender</p>
                  <p className="font-semibold text-slate-950">{row.donor}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${row.donor} bearbeiten`}
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${row.donor} löschen`}
                    disabled={deleteCake.isPending}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Kuchen</p>
                <p className="text-sm text-slate-800">{row.cake || "–"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Eigenschaften / Allergene</p>
                <div className="mt-1"><TraitTags row={row} /></div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Abgabezeit</p>
                <p className="text-sm text-slate-800">{row.dropoffTime || "–"}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && rows.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Noch keine Kuchenspenden erfasst.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="hidden shadow-sm md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3">Spender</th>
                <th className="p-3">Kuchen</th>
                <th className="min-w-[240px] p-3">Eigenschaften / Allergene</th>
                <th className="p-3">Abgabezeit</th>
                <th className="w-20 p-3"><span className="sr-only">Aktionen</span></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="p-4 text-muted-foreground">Lade …</td></tr>
              )}
              {(rows as CakeRow[]).map(row => (
                <tr key={row.id} className="border-t align-top hover:bg-muted/30">
                  <td className="p-3 font-medium text-slate-950">{row.donor}</td>
                  <td className="p-3 text-slate-800">{row.cake || "–"}</td>
                  <td className="p-3"><TraitTags row={row} /></td>
                  <td className="whitespace-nowrap p-3 text-slate-800">{row.dropoffTime || "–"}</td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`${row.donor} bearbeiten`} onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`${row.donor} löschen`} disabled={deleteCake.isPending} onClick={() => setDeleteTarget(row)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-muted-foreground">Noch keine Kuchenspenden erfasst.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={open => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="w-[calc(100vw-2rem)] min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] !bg-white !text-slate-950 shadow-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCake ? "Kuchenspende bearbeiten" : "Kuchen erfassen"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid min-w-0 gap-4 py-2"
            onSubmit={event => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="cake-donor">Spender <span aria-hidden="true">*</span></Label>
              <Input
                id="cake-donor"
                list="cake-donor-options"
                autoFocus
                required
                value={form.donor}
                placeholder="Helfer auswählen oder Namen eingeben"
                aria-describedby="cake-donor-hint"
                onChange={event =>
                  setForm(current => ({ ...current, donor: event.target.value }))
                }
              />
              <datalist id="cake-donor-options">
                {donorOptions.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p id="cake-donor-hint" className="text-xs text-muted-foreground">
                Helfer auswählen oder einen neuen Namen frei eingeben.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cake-name">Kuchen</Label>
                <Input id="cake-name" value={form.cake} placeholder="z. B. Rumkuchen" onChange={event => setForm(current => ({ ...current, cake: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cake-dropoff">Abgabezeit</Label>
                <Input id="cake-dropoff" value={form.dropoffTime} placeholder="z. B. Sa. 12:00" onChange={event => setForm(current => ({ ...current, dropoffTime: event.target.value }))} />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-900">Eigenschaften (optional)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {traits.map(trait => {
                  const active = form[trait.key];
                  return (
                    <Button
                      key={trait.key}
                      type="button"
                      variant="outline"
                      aria-pressed={active}
                      onClick={() => toggleTrait(trait.key)}
                      className={`h-11 justify-start border text-sm shadow-none transition-colors ${active ? trait.activeClass : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      <span className="mr-2 inline-flex size-4 items-center justify-center rounded border border-current text-[10px]" aria-hidden="true">{active ? "✓" : ""}</span>
                      {trait.label}
                    </Button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="cake-note">Hinweise & Allergene (optional)</Label>
              <Textarea
                id="cake-note"
                value={form.note}
                rows={3}
                placeholder="z. B. Enthält Alkohol/Rum, Walnüsse"
                className="resize-y text-base sm:text-sm"
                onChange={event => setForm(current => ({ ...current, note: event.target.value }))}
              />
            </div>

            <DialogFooter className="mt-1 w-full min-w-0 flex-col gap-3 border-t pt-3 sm:flex-col sm:items-stretch">
              <div className="flex w-full flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={closeDialog}>Abbrechen</Button>
                <Button type="submit" disabled={!form.donor.trim() || busy} className={editingCake ? undefined : CREATION_ACTION_BUTTON_CLASS}>
                  {busy ? "Speichert …" : "Speichern"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Kuchenspende löschen?"
        description={`„${deleteTarget?.donor ?? ""}“ wird aus Kuchen im aktuellen Veranstaltungsjahr gelöscht.`}
        busy={deleteCake.isPending}
        onConfirm={() => deleteTarget && deleteCake.mutate({ id: deleteTarget.id })}
      />
    </div>
  );
}

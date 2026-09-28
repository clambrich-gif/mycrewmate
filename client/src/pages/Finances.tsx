import { PageTitle } from "@/components/PageTitle";
import { KlemmiSurfaceGuide } from "@/components/KlemmiSurfaceGuide";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  STICKY_TABLE_CONTAINER_CLASS,
  STICKY_TABLE_HEADER_CLASS,
  STICKY_TABLE_HEADER_CELL_CLASS,
} from "@/lib/sticky-table";
import { useEventYear } from "@/contexts/YearContext";
import { trpc } from "@/lib/trpc";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const temporaryId = () => -Date.now() - Math.floor(Math.random() * 1_000);

export default function Finances() {
  const utils = trpc.useUtils();
  const listUtils = utils.finances.list;
  const { isTenantAdmin } = useTenantAdministration();
  const { year, eventId } = useEventYear();
  const { data: rows = [], isLoading } = trpc.finances.list.useQuery();
  const [category, setCategory] = useState("");
  const [klemmiCreationSignal, setKlemmiCreationSignal] = useState<number | null>(null);
  const [klemmiGuideStartedEmpty, setKlemmiGuideStartedEmpty] = useState<boolean | null>(null);

  const refreshDashboard = () => void utils.dashboard.stats.invalidate();

  const create = trpc.finances.create.useMutation({
    onMutate: async input => {
      await listUtils.cancel();
      const previous = listUtils.getData();
      const optimisticId = temporaryId();
      listUtils.setData(undefined, current => [
        ...(current ?? []),
        {
          id: optimisticId,
          year,
          eventId,
          category: input.category,
          income: input.incomeCents ?? 0,
          expense: input.expenseCents ?? 0,
          note: input.note ?? null,
          sortOrder: 0,
        },
      ]);
      return { previous, optimisticId };
    },
    onSuccess: (created, _input, context) => {
      listUtils.setData(undefined, current =>
        (current ?? []).map(row =>
          row.id === context?.optimisticId ? (created as typeof row) : row
        )
      );
      setCategory("");
      setKlemmiCreationSignal(Date.now());
      toast.success("Hinzugefügt");
    },
    onError: (error, _input, context) => {
      listUtils.setData(undefined, context?.previous);
      toast.error(error.message);
    },
    onSettled: refreshDashboard,
  });

  const update = trpc.finances.update.useMutation({
    onMutate: async input => {
      await listUtils.cancel();
      const previous = listUtils.getData();
      const { id, incomeCents, expenseCents, ...values } = input;
      const patch = {
        ...values,
        ...(incomeCents === undefined ? {} : { income: incomeCents }),
        ...(expenseCents === undefined ? {} : { expense: expenseCents }),
      };
      listUtils.setData(undefined, current =>
        (current ?? []).map(row => (row.id === id ? { ...row, ...patch } : row))
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      listUtils.setData(undefined, context?.previous);
      toast.error(error.message);
    },
    onSettled: refreshDashboard,
  });

  const remove = trpc.finances.remove.useMutation({
    onMutate: async input => {
      await listUtils.cancel();
      const previous = listUtils.getData();
      listUtils.setData(undefined, current =>
        (current ?? []).filter(row => row.id !== input.id)
      );
      return { previous };
    },
    onSuccess: () => toast.success("Entfernt"),
    onError: (error, _input, context) => {
      listUtils.setData(undefined, context?.previous);
      toast.error(error.message);
    },
    onSettled: refreshDashboard,
  });

  const submitCreate = () => {
    if (!category.trim() || create.isPending) return;
    create.mutate({ category: category.trim() });
  };

  const eur = (cents: number) =>
    (cents / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
    });
  const sumIn = rows.reduce((sum, row) => sum + row.income, 0);
  const sumOut = rows.reduce((sum, row) => sum + row.expense, 0);
  const klemmiGuideNeedsSample =
    klemmiGuideStartedEmpty ?? (!isLoading && rows.length === 0);
  const financeGuideSteps = [
    {
      key: "intro",
      selector: '[data-klemmi-target="finances-category"]',
      eyebrow: "Klemmi zeigt’s",
      title: "Finanzen einfach im Blick behalten",
      text: klemmiGuideNeedsSample
        ? "Hier ist noch keine Kategorie vorhanden. Lege gemeinsam mit Klemmi eine echte Musterkategorie an; sie kann danach stehen bleiben oder wieder gelöscht werden."
        : "Ich zeige dir die vorhandenen Kategorien, Werte und den Saldo. Dafür wird nichts neu angelegt.",
      action: "Kategorie zeigen",
    },
    {
      key: "category",
      selector: '[data-klemmi-target="finances-category"]',
      eyebrow: "Schritt 1 von 4",
      title: "Kostenart anlegen",
      text: "Trage eine klare Kategorie ein, zum Beispiel Startgelder, Catering, Technik oder Sponsoring.",
      action: "Speichern zeigen",
    },
    {
      key: "save",
      selector: '[data-klemmi-target="finances-save"]',
      eyebrow: "Schritt 2 von 4",
      title: "Kategorie übernehmen",
      text: klemmiGuideNeedsSample
        ? "Klicke auf den markierten Button. Erst dann wird die Musterkategorie wirklich angelegt und du kannst Einnahmen und Ausgaben eintragen."
        : "Der markierte Button legt eine neue Kategorie an. Für diese Erklärung klickst du nicht darauf – gleich zeige ich dir die bereits gepflegten Werte.",
      action: klemmiGuideNeedsSample ? undefined : "Werte zeigen",
      waitsForSuccess: klemmiGuideNeedsSample,
      audioKey: klemmiGuideNeedsSample ? "save" : "overview-save",
    },
    {
      key: "values",
      selector: '[data-klemmi-target="finances-values"]',
      eyebrow: "Schritt 3 von 4",
      title: "Einnahmen und Ausgaben eintragen",
      text: "In jeder Kategorie gibst du Einnahmen und Ausgaben ein. Die Werte werden beim Verlassen des Feldes gespeichert; die Differenz zeigt sofort den aktuellen Stand.",
      action: "Saldo zeigen",
    },
    {
      key: "balance",
      selector: '[data-klemmi-target="finances-balance"]',
      eyebrow: "Schritt 4 von 4",
      title: "Saldo gemeinsam prüfen",
      text: klemmiGuideNeedsSample
        ? "Die Musterkategorie steht jetzt in der Übersicht. Wenn sie nur zum Üben gedacht war, kannst du sie über das rote Löschen-Symbol wieder entfernen."
        : "Ganz unten fasst der Saldo alle Kategorien zusammen. So erkennst du schnell, ob deine Veranstaltung finanziell im Plan liegt.",
      audioKey: "complete",
      action: "Fertig",
    },
  ];

  const NumInput = ({
    value,
    onSave,
  }: {
    value: number;
    onSave: (value: number) => void;
  }) => (
    <Input
      type="number"
      step="0.01"
      className="h-11 w-full text-base md:h-8 md:w-28 md:text-sm"
      defaultValue={(value / 100).toFixed(2)}
      onBlur={event => {
        const nextValue =
          Math.round(parseFloat(event.target.value.replace(",", ".")) * 100) ||
          0;
        if (nextValue !== value) onSave(nextValue);
      }}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageTitle icon="finances">Finanzen</PageTitle>
          <p className="text-muted-foreground">
            Einnahmen und Ausgaben pro Kategorie. Differenz und Saldo werden
            automatisch berechnet.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:justify-end [&>[data-slot=button]]:w-full [&>[data-slot=button]]:justify-center [&>[data-slot=button]]:px-2 max-lg:[&>[data-slot=button]]:h-11 max-lg:[&>[data-slot=button]]:text-base lg:[&>[data-slot=button]]:w-auto lg:[&>[data-slot=button]]:px-4">
          <KlemmiSurfaceGuide
            guideId="finances"
            title="Finanzen verstehen"
            introText="Ich zeige dir, wie Kategorien, Einnahmen, Ausgaben und der Saldo zusammenhängen."
            steps={financeGuideSteps}
            successSignal={klemmiCreationSignal}
            completionAudioKey={klemmiGuideNeedsSample ? "complete" : "overview"}
            onOpenChange={open => {
              if (open) setKlemmiGuideStartedEmpty(!isLoading && rows.length === 0);
              else setKlemmiGuideStartedEmpty(null);
            }}
          />
          <ResetAreaButton area="finances" label="Finanzen" compact />
          <div data-klemmi-target="finances-category" className="col-span-2 w-full lg:order-last lg:w-64">
            <Input
              placeholder="Kategorie"
              value={category}
              onChange={event => setCategory(event.target.value)}
              className="w-full"
              onKeyDown={event => event.key === "Enter" && submitCreate()}
            />
          </div>
          <Button
            data-klemmi-target="finances-save"
            className="col-span-2 shadow-xs lg:col-auto"
            onClick={submitCreate}
            disabled={!category.trim() || create.isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            <span>{create.isPending ? "Speichert …" : "Neue Kategorie"}</span>
          </Button>
        </div>
      </div>
      <div data-klemmi-target="finances-values" className="space-y-3 md:hidden">
        {isLoading && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Lade …
            </CardContent>
          </Card>
        )}
        {rows.map(row => {
          const difference = row.income - row.expense;
          return (
            <Card key={row.id} className="shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="font-semibold">{row.category}</div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs font-medium text-muted-foreground">
                    Einnahmen
                    <NumInput
                      value={row.income}
                      onSave={value =>
                        update.mutate({ id: row.id, incomeCents: value })
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-muted-foreground">
                    Ausgaben
                    <NumInput
                      value={row.expense}
                      onSave={value =>
                        update.mutate({ id: row.id, expenseCents: value })
                      }
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/50 p-3 text-sm">
                  <span>Differenz</span>
                  <strong
                    className={
                      difference >= 0 ? "text-[var(--ok)]" : "text-[var(--err)]"
                    }
                  >
                    {eur(difference)}
                  </strong>
                </div>
                {isTenantAdmin && row.id > 0 && (
                  <Button
                    variant="outline"
                    className="w-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ id: row.id })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Kategorie löschen
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Card data-klemmi-target="finances-balance" className="border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="font-bold">Saldo</div>
            <div className="flex justify-between">
              <span>Einnahmen</span>
              <strong>{eur(sumIn)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Ausgaben</span>
              <strong>{eur(sumOut)}</strong>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span>Differenz</span>
              <strong
                className={
                  sumIn - sumOut >= 0 ? "text-[var(--ok)]" : "text-[var(--err)]"
                }
              >
                {eur(sumIn - sumOut)}
              </strong>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card data-klemmi-target="finances-values" className="hidden shadow-sm md:block">
        <CardContent className={`${STICKY_TABLE_CONTAINER_CLASS} p-0`}>
          <table className="w-full text-sm">
            <thead
              data-sticky-table-header="finances"
              className={STICKY_TABLE_HEADER_CLASS}
            >
              <tr className="text-left">
                <th className={STICKY_TABLE_HEADER_CELL_CLASS}>Kategorie</th>
                <th className={`${STICKY_TABLE_HEADER_CELL_CLASS} text-right`}>Einnahmen</th>
                <th className={`${STICKY_TABLE_HEADER_CELL_CLASS} text-right`}>Ausgaben</th>
                <th className={`${STICKY_TABLE_HEADER_CELL_CLASS} text-right`}>Differenz</th>
                <th className={`w-10 ${STICKY_TABLE_HEADER_CELL_CLASS}`}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={5}>
                    Lade …
                  </td>
                </tr>
              )}
              {rows.map(row => {
                const difference = row.income - row.expense;
                return (
                  <tr key={row.id} className="border-t hover:bg-muted/30">
                    <td className="p-2 font-medium">{row.category}</td>
                    <td className="p-2 text-right">
                      <NumInput
                        value={row.income}
                        onSave={value =>
                          update.mutate({ id: row.id, incomeCents: value })
                        }
                      />
                    </td>
                    <td className="p-2 text-right">
                      <NumInput
                        value={row.expense}
                        onSave={value =>
                          update.mutate({ id: row.id, expenseCents: value })
                        }
                      />
                    </td>
                    <td
                      className={`p-2 text-right font-semibold ${difference >= 0 ? "text-[var(--ok)]" : "text-[var(--err)]"}`}
                    >
                      {eur(difference)}
                    </td>
                    <td className="p-2">
                      {isTenantAdmin && row.id > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Finanzkategorie ${row.category} löschen`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate({ id: row.id })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr data-klemmi-target="finances-balance" className="border-t-2 font-bold">
                <td className="p-3">Saldo</td>
                <td className="p-3 text-right">{eur(sumIn)}</td>
                <td className="p-3 text-right">{eur(sumOut)}</td>
                <td
                  className={`p-3 text-right ${sumIn - sumOut >= 0 ? "text-[var(--ok)]" : "text-[var(--err)]"}`}
                >
                  {eur(sumIn - sumOut)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

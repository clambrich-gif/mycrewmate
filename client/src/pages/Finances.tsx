import { useAuth } from "@/_core/hooks/useAuth";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEventYear } from "@/contexts/YearContext";
import { trpc } from "@/lib/trpc";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const temporaryId = () => -Date.now() - Math.floor(Math.random() * 1_000);

export default function Finances() {
  const utils = trpc.useUtils();
  const listUtils = utils.finances.list;
  const { user } = useAuth();
  const { year, eventId } = useEventYear();
  const { data: rows = [], isLoading } = trpc.finances.list.useQuery();
  const [category, setCategory] = useState("");

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
      className="h-8 w-28"
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
          <h1 className="text-2xl font-bold">Finanzen</h1>
          <p className="text-muted-foreground">
            Einnahmen und Ausgaben pro Kategorie. Differenz und Saldo werden
            automatisch berechnet.
          </p>
        </div>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          <ModuleExcelImportButton area="FINANZEN" label="Finanzen" />
          <ResetAreaButton area="finances" label="Finanzen" compact />
          <Input
            placeholder="Kategorie"
            value={category}
            onChange={event => setCategory(event.target.value)}
            className="w-full sm:w-64"
            onKeyDown={event => event.key === "Enter" && submitCreate()}
          />
          <Button
            className="w-full sm:w-auto"
            onClick={submitCreate}
            disabled={!category.trim() || create.isPending}
          >
            {create.isPending ? "Speichert …" : "Hinzufügen"}
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
                {user?.role === "admin" && row.id > 0 && (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/40 text-destructive"
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
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
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
      <Card className="hidden shadow-sm md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3">Kategorie</th>
                <th className="p-3 text-right">Einnahmen</th>
                <th className="p-3 text-right">Ausgaben</th>
                <th className="p-3 text-right">Differenz</th>
                <th className="w-10 p-3"></th>
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
                      {user?.role === "admin" && row.id > 0 && (
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
              <tr className="border-t-2 font-bold">
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

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Finances() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: rows = [], isLoading } = trpc.finances.list.useQuery();
  const [category, setCategory] = useState("");
  const invalidate = () => utils.finances.list.invalidate();
  const create = trpc.finances.create.useMutation({ onSuccess: () => { invalidate(); setCategory(""); toast.success("Hinzugefügt"); } });
  const update = trpc.finances.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.finances.remove.useMutation({ onSuccess: () => { invalidate(); toast.success("Entfernt"); }, onError: e => toast.error(e.message) });

  const eur = (cents: number) => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  const sumIn = rows.reduce((s, r) => s + r.income, 0);
  const sumOut = rows.reduce((s, r) => s + r.expense, 0);

  const NumInput = ({ value, onSave }: { value: number; onSave: (v: number) => void }) => (
    <Input type="number" step="0.01" className="h-8 w-28" defaultValue={(value / 100).toString().replace(".", ",")}
      onBlur={e => { const v = Math.round(parseFloat(e.target.value.replace(",", ".")) * 100) || 0; if (v !== value) onSave(v); }} />
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Finanzen</h1><p className="text-muted-foreground">Einnahmen und Ausgaben pro Kategorie. Differenz und Saldo werden automatisch berechnet.</p></div>
        <div className="flex gap-2">
          <Input placeholder="Kategorie" value={category} onChange={e => setCategory(e.target.value)} className="w-64" onKeyDown={e => e.key === "Enter" && category.trim() && create.mutate({ category: category.trim() })} />
          <Button onClick={() => category.trim() && create.mutate({ category: category.trim() })}>Hinzufügen</Button>
        </div>
      </div>
      <Card className="shadow-sm"><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60"><tr className="text-left"><th className="p-3">Kategorie</th><th className="p-3 text-right">Einnahmen</th><th className="p-3 text-right">Ausgaben</th><th className="p-3 text-right">Differenz</th><th className="p-3 w-10"></th></tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={5}>Lade …</td></tr>}
            {rows.map(r => {
              const diff = r.income - r.expense;
              return (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-medium">{r.category}</td>
                  <td className="p-2 text-right"><NumInput value={r.income} onSave={v => update.mutate({ id: r.id, incomeCents: v })} /></td>
                  <td className="p-2 text-right"><NumInput value={r.expense} onSave={v => update.mutate({ id: r.id, expenseCents: v })} /></td>
                  <td className={`p-2 text-right font-semibold ${diff >= 0 ? "text-[var(--ok)]" : "text-[var(--err)]"}`}>{eur(diff)}</td>
                  <td className="p-2">{user?.role === "admin" && <Button variant="ghost" size="icon" onClick={() => remove.mutate({ id: r.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 font-bold">
              <td className="p-3">Saldo</td>
              <td className="p-3 text-right">{eur(sumIn)}</td>
              <td className="p-3 text-right">{eur(sumOut)}</td>
              <td className={`p-3 text-right ${sumIn - sumOut >= 0 ? "text-[var(--ok)]" : "text-[var(--err)]"}`}>{eur(sumIn - sumOut)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

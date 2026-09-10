import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const YN = [{ v: "ja", l: "Ja" }, { v: "nein", l: "Nein" }] as const;
const YNV = [{ v: "ja", l: "Ja" }, { v: "nein", l: "Nein" }, { v: "vielleicht", l: "Vielleicht" }] as const;

function Sel({ value, onChange, options }: { value: string; onChange: (v: any) => void; options: readonly { v: string; l: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export default function Helpers() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: helpers = [], isLoading } = trpc.helpers.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [apFilter, setApFilter] = useState("alle");
  const [sortAsc, setSortAsc] = useState(true);

  const invalidate = () => { utils.helpers.list.invalidate(); utils.plan.evaluate.invalidate(); utils.dashboard.stats.invalidate(); };
  const create = trpc.helpers.create.useMutation({ onSuccess: () => { invalidate(); setName(""); toast.success("Helfer hinzugefügt"); } });
  const update = trpc.helpers.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.helpers.remove.useMutation({ onSuccess: () => { invalidate(); toast.success("Entfernt"); }, onError: e => toast.error(e.message) });

  const contactName = (id: number | null) => contacts.find(c => c.id === id)?.name ?? "—";
  const filtered = useMemo(() => helpers.filter(h =>
    (!filter || h.name.toLowerCase().includes(filter.toLowerCase())) &&
    (apFilter === "alle" || String(h.contactId ?? "") === apFilter)
  ).sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)), [helpers, filter, apFilter, sortAsc]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Helfer</h1>
          <p className="text-muted-foreground">Bis zu 200 Helfer mit Ansprechpartner, Helfen-Status und Tagesverfügbarkeit.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-52" onKeyDown={e => e.key === "Enter" && name.trim() && create.mutate({ name: name.trim() })} />
          <Button onClick={() => name.trim() && create.mutate({ name: name.trim() })}>Hinzufügen</Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Suchen …" value={filter} onChange={e => setFilter(e.target.value)} className="w-56" />
        <Select value={apFilter} onValueChange={setApFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Ansprechpartner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Ansprechpartner</SelectItem>
            {contacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3">Ansprechpartner</th>
                <th className="p-3 cursor-pointer select-none" onClick={() => setSortAsc(!sortAsc)}>Name {sortAsc ? "▲" : "▼"}</th>
                <th className="p-3">Helfen?</th>
                <th className="p-3">Fr</th><th className="p-3">Sa</th><th className="p-3">So</th>
                <th className="p-3">Bestätigt?</th><th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={8}>Lade …</td></tr>}
              {filtered.map(h => (
                <tr key={h.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <Select value={h.contactId ? String(h.contactId) : "none"} onValueChange={v => update.mutate({ id: h.id, contactId: v === "none" ? null : Number(v) })}>
                      <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {contacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 font-medium">{h.name}</td>
                  <td className="p-2"><Sel value={h.willHelp} options={YN} onChange={v => update.mutate({ id: h.id, willHelp: v })} /></td>
                  <td className="p-2"><Sel value={h.availFri} options={YNV} onChange={v => update.mutate({ id: h.id, availFri: v })} /></td>
                  <td className="p-2"><Sel value={h.availSat} options={YNV} onChange={v => update.mutate({ id: h.id, availSat: v })} /></td>
                  <td className="p-2"><Sel value={h.availSun} options={YNV} onChange={v => update.mutate({ id: h.id, availSun: v })} /></td>
                  <td className="p-2"><Sel value={h.confirmed} options={YN} onChange={v => update.mutate({ id: h.id, confirmed: v })} /></td>
                  <td className="p-2">{user?.role === "admin" && <Button variant="ghost" size="icon" onClick={() => remove.mutate({ id: h.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={8}>Keine Helfer gefunden.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Legende: <StatusBadge status="ja" /> verfügbar · <StatusBadge status="vielleicht" /> unsicher · <StatusBadge status="nein" /> abgesagt/nicht verfügbar</p>
    </div>
  );
}

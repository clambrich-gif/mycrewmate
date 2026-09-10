import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function TaskList({ kind, title }: { kind: "prep" | "post"; title: string }) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const api = (trpc as any)[kind];
  const { data: rows = [], isLoading } = api.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const [task, setTask] = useState("");
  const invalidate = () => api.list.invalidate();
  const create = api.create.useMutation({ onSuccess: () => { invalidate(); setTask(""); toast.success("Hinzugefügt"); } });
  const update = api.update.useMutation({ onSuccess: invalidate });
  const remove = api.remove.useMutation({ onSuccess: () => { invalidate(); toast.success("Entfernt"); }, onError: (e: any) => toast.error(e.message) });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-muted-foreground">Aufgaben mit Verantwortlichem und Status.</p></div>
        <div className="flex gap-2">
          <Input placeholder="Neue Aufgabe" value={task} onChange={e => setTask(e.target.value)} className="w-72" onKeyDown={e => e.key === "Enter" && task.trim() && create.mutate({ task: task.trim() })} />
          <Button onClick={() => task.trim() && create.mutate({ task: task.trim() })}>Hinzufügen</Button>
        </div>
      </div>
      <Card className="shadow-sm"><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60"><tr className="text-left"><th className="p-3">Aufgabe</th><th className="p-3">Verantwortlich</th><th className="p-3">Status</th><th className="p-3 w-10"></th></tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={4}>Lade …</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-2 font-medium">{r.task}</td>
                <td className="p-2">
                  <Select value={r.contactId ? String(r.contactId) : "none"} onValueChange={v => update.mutate({ id: r.id, contactId: v === "none" ? null : Number(v) })}>
                    <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{contacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  <Select value={r.status} onValueChange={v => update.mutate({ id: r.id, status: v })}>
                    <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="offen">offen</SelectItem><SelectItem value="inArbeit">in Arbeit</SelectItem><SelectItem value="erledigt">erledigt</SelectItem></SelectContent>
                  </Select>
                </td>
                <td className="p-2">{user?.role === "admin" && <Button variant="ghost" size="icon" onClick={() => remove.mutate({ id: r.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={4}>Noch keine Aufgaben.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

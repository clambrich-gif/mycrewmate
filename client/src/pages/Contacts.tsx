import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Contacts() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: contacts = [], isLoading } = trpc.contacts.list.useQuery();
  const [name, setName] = useState("");
  const create = trpc.contacts.create.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); setName(""); toast.success("Ansprechpartner hinzugefügt"); },
  });
  const remove = trpc.contacts.remove.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); toast.success("Entfernt"); },
    onError: e => toast.error(e.message),
  });
  const update = trpc.contacts.update.useMutation({ onSuccess: () => { utils.contacts.list.invalidate(); toast.success("Aktualisiert"); } });
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Ansprechpartner</h1>
        <p className="text-muted-foreground">Alle verantwortlichen Ansprechpartner / Vorstandsmitglieder. Diese Liste speist die Dropdowns in allen Bereichen.</p>
      </div>
      <div className="flex gap-2">
        <Input placeholder="Name des Ansprechpartners" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && name.trim() && create.mutate({ name: name.trim() })} />
        <Button onClick={() => name.trim() && create.mutate({ name: name.trim() })} disabled={create.isPending}>Hinzufügen</Button>
      </div>
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Liste ({contacts.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Lade …</p> : (
            <ul className="divide-y">
              {contacts.map(c => (
                <li key={c.id} className="flex items-center justify-between py-2.5">
                  {editId === c.id ? (
                    <Input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && editName.trim()) { update.mutate({ id: c.id, name: editName.trim() }); setEditId(null); } if (e.key === "Escape") setEditId(null); }}
                      onBlur={() => setEditId(null)} className="h-8" />
                  ) : (
                    <span>{c.name}</span>
                  )}
                  <span className="flex items-center">
                    <Button variant="ghost" size="icon" onClick={() => { setEditId(c.id); setEditName(c.name); }}><Pencil className="h-4 w-4" /></Button>
                    {user?.role === "admin" && (
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate({ id: c.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </span>
                </li>
              ))}
              {contacts.length === 0 && <li className="py-3 text-muted-foreground">Noch keine Ansprechpartner angelegt.</li>}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

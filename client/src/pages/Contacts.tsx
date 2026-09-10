import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Pencil, Phone, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { ResetAreaButton } from "@/components/ResetAreaButton";

export default function Contacts() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: contacts = [], isLoading } = trpc.contacts.list.useQuery();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const invalidate = () => {
    utils.contacts.list.invalidate();
    utils.pdf.settings.invalidate();
  };
  const create = trpc.contacts.create.useMutation({
    onSuccess: () => {
      invalidate();
      setName("");
      setPhone("");
      toast.success("Ansprechpartner hinzugefügt");
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.contacts.remove.useMutation({
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Entfernt");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.contacts.update.useMutation({
    onSuccess: () => {
      invalidate();
      setEditId(null);
      toast.success("Aktualisiert");
    },
    onError: error => toast.error(error.message),
  });

  const addContact = () => {
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), phone: phone.trim() || undefined });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Ansprechpartner</h1>
          <p className="text-muted-foreground">
            Name und Rufnummer werden den Helfern zugeordnet und auf deren
            Aufgaben-PDF ausgegeben.
          </p>
        </div>
        <ResetAreaButton area="contacts" label="Ansprechpartner" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
        <Input
          placeholder="Name des Ansprechpartners"
          value={name}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => event.key === "Enter" && addContact()}
        />
        <Input
          type="tel"
          placeholder="Rufnummer"
          value={phone}
          onChange={event => setPhone(event.target.value)}
          onKeyDown={event => event.key === "Enter" && addContact()}
        />
        <Button
          onClick={addContact}
          disabled={create.isPending || !name.trim()}
        >
          Hinzufügen
        </Button>
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Liste ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Lade …</p>
          ) : (
            <ul className="divide-y">
              {contacts.map(contact => (
                <li
                  key={contact.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  {editId === contact.id ? (
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <Input
                        autoFocus
                        value={editName}
                        onChange={event => setEditName(event.target.value)}
                        placeholder="Name"
                      />
                      <Input
                        type="tel"
                        value={editPhone}
                        onChange={event => setEditPhone(event.target.value)}
                        placeholder="Rufnummer"
                        onKeyDown={event => {
                          if (event.key === "Enter" && editName.trim()) {
                            update.mutate({
                              id: contact.id,
                              name: editName.trim(),
                              phone: editPhone.trim() || null,
                            });
                          }
                          if (event.key === "Escape") setEditId(null);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="font-medium">{contact.name}</div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {contact.phone || "Keine Rufnummer hinterlegt"}
                      </div>
                    </div>
                  )}
                  <span className="flex items-center gap-1">
                    {editId === contact.id ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditId(null)}
                        >
                          Abbrechen
                        </Button>
                        <Button
                          size="sm"
                          disabled={!editName.trim() || update.isPending}
                          onClick={() =>
                            update.mutate({
                              id: contact.id,
                              name: editName.trim(),
                              phone: editPhone.trim() || null,
                            })
                          }
                        >
                          Speichern
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Bearbeiten"
                        onClick={() => {
                          setEditId(contact.id);
                          setEditName(contact.name);
                          setEditPhone(contact.phone ?? "");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {user?.role === "admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Löschen"
                        onClick={() =>
                          setDeleteTarget({
                            id: contact.id,
                            name: contact.name,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
              {contacts.length === 0 && (
                <li className="py-3 text-muted-foreground">
                  Noch keine Ansprechpartner angelegt.
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
      <AdminPasswordDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Ansprechpartner löschen?"
        description={`„${deleteTarget?.name ?? ""}“ wird gelöscht. Bestehende Zuordnungen verlieren dadurch ihren Ansprechpartner.`}
        confirmLabel="Ansprechpartner löschen"
        busy={remove.isPending}
        onConfirm={adminPassword =>
          deleteTarget && remove.mutate({ id: deleteTarget.id, adminPassword })
        }
      />
    </div>
  );
}

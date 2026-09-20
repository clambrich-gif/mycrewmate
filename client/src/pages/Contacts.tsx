import { useAuth } from "@/_core/hooks/useAuth";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CREATION_ACTION_BUTTON_CLASS } from "@/lib/creation-action";
import { trpc } from "@/lib/trpc";
import { Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { ResetAreaButton } from "@/components/ResetAreaButton";
import { ModuleExcelImportButton } from "@/components/ModuleExcelImportButton";

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
    utils.helpers.list.invalidate();
    utils.plan.evaluate.invalidate();
    utils.dashboard.stats.invalidate();
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
    onSuccess: result => {
      invalidate();
      setDeleteTarget(null);
      toast.success(
        result.deletedHelperId
          ? "Ansprechpartner und eigener Helfereintrag entfernt"
          : "Ansprechpartner entfernt"
      );
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
          <PageTitle icon="contacts">Ansprechpartner</PageTitle>
          <p className="text-muted-foreground">
            Name und Rufnummer werden den Helfern zugeordnet und auf deren
            Aufgaben-PDF ausgegeben.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ModuleExcelImportButton
            area="ANSPRECHPARTNER"
            label="Ansprechpartner"
          />
          <ResetAreaButton area="contacts" label="Ansprechpartner" />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto] lg:hidden">
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
          type="button"
          variant="outline"
          className={CREATION_ACTION_BUTTON_CLASS}
          onClick={addContact}
          disabled={create.isPending || !name.trim()}
        >
          <Plus className="h-4 w-4" />
          Hinzufügen
        </Button>
      </div>
      <Card className="hidden border-blue-200 bg-slate-50/80 shadow-sm lg:block">
        <CardContent className="grid items-end gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="space-y-1.5">
            <label htmlFor="new-contact-name" className="text-sm font-semibold text-slate-800">
              Neuanlage – Name des Ansprechpartners
            </label>
            <Input
              id="new-contact-name"
              placeholder="Name des neuen Ansprechpartners eingeben"
              value={name}
              onChange={event => setName(event.target.value)}
              onKeyDown={event => event.key === "Enter" && addContact()}
              className="h-11 border-slate-300 bg-white text-base shadow-sm placeholder:text-slate-600"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-contact-phone" className="text-sm font-semibold text-slate-800">
              Neuanlage – Rufnummer
            </label>
            <Input
              id="new-contact-phone"
              type="tel"
              placeholder="z. B. 0170 1234567"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              onKeyDown={event => event.key === "Enter" && addContact()}
              className="h-11 border-slate-300 bg-white text-base shadow-sm placeholder:text-slate-600"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className={`h-11 px-5 ${CREATION_ACTION_BUTTON_CLASS}`}
            onClick={addContact}
            disabled={create.isPending || !name.trim()}
          >
            <Plus className="h-5 w-5" />
            {create.isPending ? "Speichert …" : "Hinzufügen"}
          </Button>
        </CardContent>
      </Card>
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
        description={`„${deleteTarget?.name ?? ""}“ und der gleichnamige eigene Helfereintrag werden gemeinsam gelöscht. Andere betreute Helfer bleiben erhalten und verlieren nur ihre Ansprechpartner-Zuordnung.`}
        confirmLabel="OK, löschen"
        busy={remove.isPending}
        onConfirm={adminPassword =>
          deleteTarget && remove.mutate({ id: deleteTarget.id, adminPassword })
        }
      />
    </div>
  );
}

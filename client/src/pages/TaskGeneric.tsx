import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { ResetAreaButton } from "@/components/ResetAreaButton";

const resetAreaByKind = {
  materials: "materials",
  marketing: "marketing",
  approvals: "approvals",
  cakes: "cakes",
} as const;

interface Col {
  key: string;
  label: string;
}
interface Props {
  kind: string;
  title: string;
  addLabel: string;
  nameKey: string;
  columns: Col[];
  statusField?: boolean;
  statusOptions?: { v: string; l: string }[];
  extraField?: {
    key: string;
    label: string;
    options: { v: string; l: string }[];
  };
  noContact?: boolean;
  noStatus?: boolean;
}

export default function TaskGeneric({
  kind,
  title,
  addLabel,
  nameKey,
  columns,
  statusField,
  statusOptions,
  extraField,
  noContact,
  noStatus,
}: Props) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const api = (trpc as any)[kind];
  const { data: rows = [], isLoading } = api.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const [name, setName] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const invalidate = () => api.list.invalidate();
  const create = api.create.useMutation({
    onSuccess: () => {
      invalidate();
      setName("");
      setExtras({});
      toast.success("Hinzugefügt");
    },
  });
  const update = api.update.useMutation({ onSuccess: invalidate });
  const remove = api.remove.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Entfernt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const defaultStatus = statusOptions ?? [
    { v: "offen", l: "offen" },
    { v: "inArbeit", l: "in Arbeit" },
    { v: "erledigt", l: "erledigt" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {kind in resetAreaByKind && (
            <ResetAreaButton
              area={resetAreaByKind[kind as keyof typeof resetAreaByKind]}
              label={title}
              compact
            />
          )}
          <Input
            placeholder={`Neu: ${addLabel}`}
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-64"
            onKeyDown={e =>
              e.key === "Enter" &&
              name.trim() &&
              create.mutate({ [nameKey]: name.trim() })
            }
          />
          {columns.map(c => (
            <Input
              key={c.key}
              placeholder={c.label}
              value={extras[c.key] ?? ""}
              onChange={e => setExtras({ ...extras, [c.key]: e.target.value })}
              className="w-36"
            />
          ))}
          <Button
            onClick={() =>
              name.trim() &&
              create.mutate({ [nameKey]: name.trim(), ...extras })
            }
          >
            Hinzufügen
          </Button>
        </div>
      </div>
      <Card className="shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3">{addLabel}</th>
                {columns.map(c => (
                  <th key={c.key} className="p-3">
                    {c.label}
                  </th>
                ))}
                {!noContact && <th className="p-3">Verantwortlich</th>}
                {!noStatus && <th className="p-3">Status</th>}
                {extraField && <th className="p-3">{extraField.label}</th>}
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={8}>
                    Lade …
                  </td>
                </tr>
              )}
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <Input
                      className="h-8 w-full min-w-[140px] font-medium"
                      defaultValue={r[nameKey] ?? ""}
                      onBlur={e => {
                        if (e.target.value !== (r[nameKey] ?? ""))
                          update.mutate({
                            id: r.id,
                            [nameKey]: e.target.value,
                          });
                      }}
                    />
                  </td>
                  {columns.map(c => (
                    <td key={c.key} className="p-2">
                      <Input
                        className="h-8 w-full min-w-[90px]"
                        defaultValue={r[c.key] ?? ""}
                        onBlur={e => {
                          if (e.target.value !== (r[c.key] ?? ""))
                            update.mutate({
                              id: r.id,
                              [c.key]: e.target.value,
                            });
                        }}
                      />
                    </td>
                  ))}
                  {!noContact && (
                    <td className="p-2">
                      <Select
                        value={r.contactId ? String(r.contactId) : "none"}
                        onValueChange={v =>
                          update.mutate({
                            id: r.id,
                            contactId: v === "none" ? null : Number(v),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {contacts.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  {!noStatus && (
                    <td className="p-2">
                      <Select
                        value={r.status}
                        onValueChange={v =>
                          update.mutate({ id: r.id, status: v })
                        }
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {defaultStatus.map(o => (
                            <SelectItem key={o.v} value={o.v}>
                              {o.l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  {extraField && (
                    <td className="p-2">
                      <Select
                        value={r[extraField.key]}
                        onValueChange={v =>
                          update.mutate({ id: r.id, [extraField.key]: v })
                        }
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {extraField.options.map(o => (
                            <SelectItem key={o.v} value={o.v}>
                              {o.l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  <td className="p-2">
                    {user?.role === "admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove.mutate({ id: r.id })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={8}>
                    Noch keine Einträge.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

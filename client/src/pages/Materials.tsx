import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { MapPin, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import TaskGeneric from "./TaskGeneric";

export default function Materials() {
  const { data: locations = [] } = trpc.locations.list.useQuery();
  const [locationId, setLocationId] = useState("none");
  const packlist = trpc.pdf.materialPacklist.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success("Material-Packliste wurde als PDF erstellt");
    },
    onError: error => toast.error(error.message),
  });

  return (
    <TaskGeneric
      kind="materials"
      title="Material"
      addLabel="Artikel"
      nameKey="article"
      columns={[
        { key: "category", label: "Kategorie" },
        { key: "quantity", label: "Menge" },
        { key: "unit", label: "Einheit" },
      ]}
      extraField={{
        key: "status",
        label: "Stand",
        options: [
          { v: "offen", l: "🔴 Offen" },
          { v: "bestellt", l: "🟡 Bestellt" },
          { v: "geliefert", l: "🟢 Geliefert" },
        ],
      }}
      noStatus
      locationField
      deletionRequiresContact
      createInDialog
      createDialogTitle="Neuen Artikel anlegen"
      createTriggerLabel="Neuer Artikel"
      createButtonClassName="border-rose-700 bg-rose-600 text-base font-semibold text-white shadow-xs hover:bg-rose-700 hover:text-white focus-visible:ring-rose-500"
      headerLayout="stacked"
      filterConfig={{
        categoryKey: "category",
        categoryLabel: "Kategorien",
        statusKey: "status",
        statusLabel: "Stände",
        searchPlaceholder: "Suchen (Artikel/Kategorie/Verantwortlicher/Ort) …",
      }}
      headerActions={
        <>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger
              aria-label="Standort für Material-Packliste auswählen"
              className="h-11 w-full bg-white text-base sm:h-10 sm:text-sm"
            >
              <MapPin className="mr-2 size-4 text-blue-700" aria-hidden="true" />
              <SelectValue placeholder="Standort wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Standort für Packliste wählen</SelectItem>
              {locations.map(location => (
                <SelectItem key={location.id} value={String(location.id)}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="h-11 border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
            disabled={locationId === "none" || packlist.isPending}
            onClick={() => packlist.mutate({ locationId: Number(locationId) })}
          >
            <Printer className="mr-2 size-4" aria-hidden="true" />
            {packlist.isPending ? "PDF wird erstellt …" : "PDF drucken"}
          </Button>
        </>
      }
    />
  );
}

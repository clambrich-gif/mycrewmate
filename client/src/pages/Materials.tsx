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
import { FileDown, MapPin } from "lucide-react";
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
        key: "ordered",
        label: "Bestellt?",
        options: [
          { v: "nein", l: "Nein" },
          { v: "ja", l: "Ja" },
        ],
      }}
      noStatus
      locationField
      sortableAndFilterable
      deletionRequiresContact
      createInDialog
      createDialogTitle="Neuen Artikel anlegen"
      createTriggerLabel="Neuer Artikel"
      headerActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger
              aria-label="Standort für Material-Packliste auswählen"
              className="h-11 w-full min-w-56 bg-white sm:w-64"
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
            <FileDown className="mr-2 size-4" aria-hidden="true" />
            {packlist.isPending ? "PDF wird erstellt …" : "Packliste PDF"}
          </Button>
        </div>
      }
    />
  );
}

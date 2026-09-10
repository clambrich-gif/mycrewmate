import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEventYear } from "@/contexts/YearContext";

export default function Excel() {
  const { user } = useAuth();
  const { year } = useEventYear();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const importMut = trpc.excel.importFile.useMutation({
    onSuccess: r => {
      toast.success(
        `Für ${year}: ${r.kontakte} Ansprechpartner, ${r.helfer} neue Helfer, ${r.aktualisiert} aktualisiert, ${r.uebersprungen} Dubletten übersprungen`
      );
      setBusy(false);
    },
    onError: e => {
      toast.error(e.message);
      setBusy(false);
    },
  });
  const exportQ = trpc.excel.exportFile.useQuery(undefined, { enabled: false });

  const onImport = async (file: File) => {
    setBusy(true);
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++)
      binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    importMut.mutate({ base64 });
  };
  const onExport = async () => {
    const { data } = await exportQ.refetch();
    if (!data) return;
    const bin = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    const blob = new Blob([bin], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `MyEifelRide_Planung_${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Excel Import / Export</h1>
        <p className="text-muted-foreground">
          Import und Export beziehen sich ausschließlich auf das gewählte
          Veranstaltungsjahr {year}.
        </p>
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Liest alle unterstützten Blätter in die Planung {year} ein. Namen
            werden vereinheitlicht; vorhandene Ansprechpartner und Helfer werden
            aktualisiert statt doppelt angelegt. Wiederholte Importe
            überspringen bereits vorhandene Datensätze. Nur für Administratoren.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={e => e.target.files?.[0] && onImport(e.target.files[0])}
          />
          <Button
            disabled={busy || user?.role !== "admin"}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />{" "}
            {busy ? "Importiere …" : "Excel-Datei importieren"}
          </Button>
          {user?.role !== "admin" && (
            <p className="text-xs text-muted-foreground">
              Nur Administratoren können importieren.
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Exportiert alle Planungsdaten (Ansprechpartner, Helfer, Einsatzplan,
            alle Bereiche) als Excel-Datei.
          </p>
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" /> Als Excel exportieren
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

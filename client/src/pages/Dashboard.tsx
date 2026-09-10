import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";

export default function Dashboard() {
  const { data: s, isLoading } = trpc.dashboard.stats.useQuery();
  if (isLoading || !s) return <div className="text-muted-foreground">Lade Dashboard …</div>;

  const cards = [
    { label: "Schichten gesamt", value: s.schichtenGesamt, badge: null },
    { label: "Offen", value: s.offen, badge: "OFFEN" },
    { label: "Knapp besetzt", value: s.knapp, badge: "KNAPP" },
    { label: "Voll besetzt", value: s.ok, badge: "OK" },
    { label: "Helferbedarf", value: s.bedarfGesamt, badge: null },
    { label: "Besetzt", value: s.besetztGesamt, badge: null },
    { label: "Helfer gesamt", value: s.helferGesamt, badge: null },
    { label: "Bestätigt", value: s.helferBestaetigt, badge: null },
    { label: "Doppelbelegungen", value: s.doppelGesamt, badge: "KNAPP" },
    { label: "Ausfälle", value: s.ausfallGesamt, badge: "OFFEN" },
    { label: "Offene Vorbereitung", value: s.offeneVorbereitung, badge: null },
    { label: "Offene Nachbereitung", value: s.offeneNachbereitung, badge: null },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Alle Kennzahlen werden automatisch aus den Planungsdaten berechnet.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="shadow-sm">
            <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground font-medium">{c.label}</CardTitle></CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-bold">{c.value}</span>
              {c.badge && <StatusBadge status={c.badge} />}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Verantwortlichkeiten pro Ansprechpartner</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-left text-muted-foreground border-b"><th className="py-2 pr-3">Ansprechpartner</th><th className="py-2 px-2 text-right">Helfer</th><th className="py-2 px-2 text-right">Vorb.</th><th className="py-2 px-2 text-right">Nachb.</th><th className="py-2 px-2 text-right">Mat.</th><th className="py-2 px-2 text-right">Mark.</th><th className="py-2 px-2 text-right">Genehm.</th><th className="py-2 pl-2 text-right">Gesamt</th></tr></thead>
              <tbody>
                {s.verantwortlichkeiten.map(v => (
                  <tr key={v.name} className="border-b last:border-0">
                    <td className="py-2 pr-3">{v.name}</td>
                    <td className="py-2 px-2 text-right">{v.betreuteHelfer}</td>
                    <td className="py-2 px-2 text-right">{v.vorbereitung}</td>
                    <td className="py-2 px-2 text-right">{v.nachbereitung}</td>
                    <td className="py-2 px-2 text-right">{v.material}</td>
                    <td className="py-2 px-2 text-right">{v.marketing}</td>
                    <td className="py-2 px-2 text-right">{v.genehmigungen}</td>
                    <td className="py-2 pl-2 text-right font-semibold">{v.gesamt}</td>
                  </tr>
                ))}
                {s.verantwortlichkeiten.length === 0 && <tr><td className="py-3 text-muted-foreground" colSpan={8}>Noch keine Ansprechpartner angelegt.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle>Helferauslastung (eingeteilte Schichten)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">Helfer</th><th className="text-right">Fr</th><th className="text-right">Sa</th><th className="text-right">So</th><th className="text-right">Gesamt</th></tr></thead>
              <tbody>
                {s.auslastung.map(a => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td className="py-2">{a.name}</td>
                    <td className="text-right">{a.fr}</td><td className="text-right">{a.sa}</td><td className="text-right">{a.so}</td>
                    <td className="text-right font-semibold">{a.gesamt}</td>
                  </tr>
                ))}
                {s.auslastung.length === 0 && <tr><td className="py-3 text-muted-foreground" colSpan={5}>Noch keine Helfer eingeteilt.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { WEEKDAYS, WEEKDAY_SHORT_LABELS } from "@shared/weekdays";

type MetricCard = {
  label: string;
  value: number;
  badge: string | null;
};

type MetricSection = {
  title: string;
  className: string;
  titleClassName: string;
  cards: MetricCard[];
};

export default function Dashboard() {
  const { data: s, isLoading } = trpc.dashboard.stats.useQuery();
  if (isLoading || !s)
    return <div className="text-muted-foreground">Lade Dashboard …</div>;

  const sections: MetricSection[] = [
    {
      title: "Bereich Schichten",
      className: "border-sky-300 bg-sky-50/90",
      titleClassName: "text-sky-950",
      cards: [
        { label: "Schichten gesamt", value: s.schichtenGesamt, badge: null },
        { label: "Offen", value: s.offen, badge: "OFFEN" },
        { label: "Knapp besetzt", value: s.knapp, badge: "KNAPP" },
        { label: "Voll besetzt", value: s.ok, badge: "OK" },
      ],
    },
    {
      title: "Bereich Helferbedarf & Belegung",
      className: "border-emerald-300 bg-emerald-50/90",
      titleClassName: "text-emerald-950",
      cards: [
        { label: "Helferbedarf", value: s.bedarfGesamt, badge: null },
        { label: "Besetzt", value: s.besetztGesamt, badge: null },
        { label: "Helfer gesamt", value: s.helferGesamt, badge: null },
        { label: "Bestätigt", value: s.helferBestaetigt, badge: null },
      ],
    },
    {
      title: "Bereich Handlungsbedarf & Warnungen",
      className: "border-amber-300 bg-amber-50/90",
      titleClassName: "text-amber-950",
      cards: [
        { label: "Doppelbelegungen", value: s.doppelGesamt, badge: "KNAPP" },
        { label: "Ausfälle", value: s.ausfallGesamt, badge: "OFFEN" },
        {
          label: "Offene Vorbereitung",
          value: s.offeneVorbereitung,
          badge: null,
        },
        {
          label: "Offene Nachbereitung",
          value: s.offeneNachbereitung,
          badge: null,
        },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Alle Kennzahlen werden automatisch aus den Planungsdaten berechnet.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map(section => (
          <section
            key={section.title}
            data-dashboard-section={section.title}
            className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${section.className}`}
          >
            <h2
              className={`mb-3 text-sm font-extrabold tracking-wide uppercase sm:text-base ${section.titleClassName}`}
            >
              {section.title}
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              {section.cards.map(metric => (
                <Card
                  key={metric.label}
                  className="border-slate-200 bg-white text-slate-950 shadow-sm"
                >
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      {metric.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-end justify-between">
                    <span className="text-3xl font-bold">{metric.value}</span>
                    {metric.badge && <StatusBadge status={metric.badge} />}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Verantwortlichkeiten pro Ansprechpartner</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-[560px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Ansprechpartner</th>
                  <th className="px-2 py-2 text-right">Helfer</th>
                  <th className="px-2 py-2 text-right">Vorb.</th>
                  <th className="px-2 py-2 text-right">Nachb.</th>
                  <th className="px-2 py-2 text-right">Mat.</th>
                  <th className="px-2 py-2 text-right">Mark.</th>
                  <th className="px-2 py-2 text-right">Genehm.</th>
                  <th className="py-2 pl-2 text-right">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {s.verantwortlichkeiten.map(v => (
                  <tr key={v.name} className="border-b last:border-0">
                    <td className="py-2 pr-3">{v.name}</td>
                    <td className="px-2 py-2 text-right">{v.betreuteHelfer}</td>
                    <td className="px-2 py-2 text-right">{v.vorbereitung}</td>
                    <td className="px-2 py-2 text-right">{v.nachbereitung}</td>
                    <td className="px-2 py-2 text-right">{v.material}</td>
                    <td className="px-2 py-2 text-right">{v.marketing}</td>
                    <td className="px-2 py-2 text-right">{v.genehmigungen}</td>
                    <td className="py-2 pl-2 text-right font-semibold">
                      {v.gesamt}
                    </td>
                  </tr>
                ))}
                {s.verantwortlichkeiten.length === 0 && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={8}>
                      Noch keine Ansprechpartner angelegt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Helferauslastung (eingeteilte Schichten)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Helfer</th>
                  {WEEKDAYS.map(day => (
                    <th key={day} className="text-right" title={day}>
                      {WEEKDAY_SHORT_LABELS[day]}
                    </th>
                  ))}
                  <th className="text-right">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {s.auslastung.map(a => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td className="py-2">{a.name}</td>
                    {WEEKDAYS.map(day => (
                      <td key={day} className="text-right">
                        {a.byDay[day]}
                      </td>
                    ))}
                    <td className="text-right font-semibold">{a.gesamt}</td>
                  </tr>
                ))}
                {s.auslastung.length === 0 && (
                  <tr>
                    <td
                      className="py-3 text-muted-foreground"
                      colSpan={WEEKDAYS.length + 2}
                    >
                      Noch keine Helfer eingeteilt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

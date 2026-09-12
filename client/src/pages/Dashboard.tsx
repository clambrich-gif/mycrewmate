import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  eventWeekdays,
  WEEKDAY_AVAILABILITY_FIELDS,
  WEEKDAY_SHORT_LABELS,
  type Weekday,
} from "@shared/weekdays";

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
  const { data: helpers = [], isLoading: areHelpersLoading } =
    trpc.helpers.list.useQuery();
  const { data: currentEvent, isLoading: isEventLoading } =
    trpc.events.current.useQuery();
  const activeDays = currentEvent ? eventWeekdays(currentEvent.activeDays) : [];
  const helperByName = new Map(helpers.map(helper => [helper.name, helper]));
  const zeroAvailability = (helperName: string, day: Weekday) => {
    const helper = helperByName.get(helperName);
    return helper?.[WEEKDAY_AVAILABILITY_FIELDS[day]];
  };
  if (isLoading || isEventLoading || areHelpersLoading || !s || !currentEvent)
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
                  className="min-w-0 border-slate-200 bg-white text-slate-950 shadow-sm"
                >
                  <CardHeader className="min-w-0 p-3 pb-1 sm:p-6 sm:pb-1">
                    <CardTitle className="min-w-0 break-words text-xs leading-snug font-medium whitespace-normal text-slate-600 sm:text-sm">
                      {metric.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex min-w-0 flex-wrap items-end justify-between gap-1 p-3 pt-0 sm:p-6 sm:pt-0">
                    <span className="text-2xl font-bold sm:text-3xl">
                      {metric.value}
                    </span>
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
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Helferauslastung (eingeteilte Schichten)</CardTitle>
            <div
              className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium sm:text-xs"
              aria-label="Legende: Null in Grün bedeutet verfügbar, Null in Rot bedeutet nicht verfügbar"
            >
              <span className="text-emerald-700 dark:text-emerald-400">
                <strong>0</strong> = verfügbar
              </span>
              <span className="text-muted-foreground" aria-hidden="true">
                |
              </span>
              <span className="text-red-700 dark:text-red-400">
                <strong>0</strong> = nicht verfügbar
              </span>
            </div>
          </CardHeader>
          <CardContent className="overflow-hidden px-3 sm:px-6">
            <table className="w-full table-fixed text-xs sm:text-sm">
              <colgroup>
                <col className="w-[36%]" />
                {activeDays.map(day => (
                  <col key={day} />
                ))}
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-1 sm:pr-2">Helfer</th>
                  {activeDays.map(day => (
                    <th
                      key={day}
                      className="px-0.5 py-2 text-right sm:px-1"
                      title={day}
                    >
                      {WEEKDAY_SHORT_LABELS[day]}
                    </th>
                  ))}
                  <th className="py-2 pl-0.5 text-right sm:pl-1">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {s.auslastung.map(a => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td
                      className="overflow-hidden text-ellipsis whitespace-nowrap py-2 pr-1 sm:pr-2"
                      title={a.name}
                    >
                      {a.name}
                    </td>
                    {activeDays.map(day => {
                      const value = a.byDay[day];
                      const availability = zeroAvailability(a.name, day);
                      const availabilityClass =
                        value !== 0
                          ? ""
                          : availability === "ja"
                            ? "font-semibold text-emerald-700 dark:text-emerald-400"
                            : availability === "nein"
                              ? "font-semibold text-red-700 dark:text-red-400"
                              : "";
                      const availabilityTitle =
                        value !== 0
                          ? undefined
                          : availability === "ja"
                            ? `${day}: verfügbar, noch keine Schicht`
                            : availability === "nein"
                              ? `${day}: nicht verfügbar`
                              : `${day}: Verfügbarkeit vielleicht`;
                      return (
                        <td
                          key={day}
                          className={`px-0.5 py-2 text-right tabular-nums sm:px-1 ${availabilityClass}`}
                          title={availabilityTitle}
                        >
                          {value}
                        </td>
                      );
                    })}
                    <td className="py-2 pl-0.5 text-right font-semibold tabular-nums sm:pl-1">
                      {a.gesamt}
                    </td>
                  </tr>
                ))}
                {s.auslastung.length === 0 && (
                  <tr>
                    <td
                      className="py-3 text-muted-foreground"
                      colSpan={activeDays.length + 2}
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

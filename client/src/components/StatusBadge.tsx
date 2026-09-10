export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    OK: { cls: "badge-ok", label: "OK" },
    erledigt: { cls: "badge-ok", label: "erledigt" },
    genehmigt: { cls: "badge-ok", label: "genehmigt" },
    ja: { cls: "badge-ok", label: "Ja" },
    KNAPP: { cls: "badge-warn", label: "KNAPP" },
    inArbeit: { cls: "badge-warn", label: "in Arbeit" },
    beantragt: { cls: "badge-warn", label: "beantragt" },
    vielleicht: { cls: "badge-warn", label: "Vielleicht" },
    OFFEN: { cls: "badge-err", label: "OFFEN" },
    offen: { cls: "badge-err", label: "offen" },
    abgelehnt: { cls: "badge-err", label: "abgelehnt" },
    nein: { cls: "badge-err", label: "Nein" },
  };
  const m = map[status] ?? { cls: "badge-neutral", label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

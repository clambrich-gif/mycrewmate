import {
  productAllowsCapability,
  type ProductPackageId,
} from "@shared/product-packages";

export type KlemmiLocationGuideArea =
  | "plan"
  | "preparation"
  | "postprocessing";

export type KlemmiLocationGuideCopy = {
  title: string;
  text: string;
  audioKey: string;
};

/**
 * Orts- und Standortfelder haben je nach Produktpaket einen anderen Nutzen.
 * Die Klemmi-Führung beschreibt daher nur Funktionen, die im jeweiligen
 * Paket tatsächlich verfügbar sind.
 */
export function getKlemmiLocationGuideCopy(
  area: KlemmiLocationGuideArea,
  currentPackageId: ProductPackageId
): KlemmiLocationGuideCopy {
  const stepPrefix = area === "plan" ? "location" : "area-location";
  const context =
    area === "plan"
      ? {
          eventPass: "Bei dieser Schicht kannst du einen Ort als klare Einordnung ergänzen. Im Event Pass bleibt die Planung bewusst schlank: Eine zentrale Ortsverwaltung und die Kartenansicht sind nicht enthalten.",
          light: "Wähle hier einen zentral gepflegten Ort aus. Im Light-Paket steht er in Schichten, Vorbereitung und Material immer wieder zur Auswahl. GPS-Punkte, Strecken und die Live-Standortkarte sind eine Erweiterung ab Pro.",
          pro: "Wähle hier einen zentral gepflegten Ort aus. In Pro und Enterprise kann derselbe Ort zusätzlich mit GPS-Daten und der Live-Standortkarte verknüpft werden. So sieht das Team die Aufgabe im Plan und bei Bedarf direkt auf der Karte.",
        }
      : area === "preparation"
        ? {
            eventPass: "Ordne die Vorbereitungsaufgabe zuerst einem Bereich und bei Bedarf einem Ort zu. Die Ortsangabe sorgt für Klarheit in der Aufgabe; eine zentrale Ortsverwaltung und Karte sind im Event Pass nicht enthalten.",
            light: "Ordne die Vorbereitungsaufgabe zuerst einem Bereich und einem zentral gepflegten Ort zu. Der Ort kann später auch in Schichten und im Material verwendet werden. GPS-Punkte und die Live-Standortkarte gehören ab Pro dazu.",
            pro: "Ordne die Vorbereitungsaufgabe zuerst einem Bereich und einem zentral gepflegten Ort zu. In Pro und Enterprise kann derselbe Ort zusätzlich GPS-Daten und einen Platz auf der Live-Standortkarte erhalten.",
          }
        : {
            eventPass: "Ordne die Nachbereitungsaufgabe zuerst einem Bereich und bei Bedarf einem Ort zu. Die Ortsangabe sorgt für Klarheit in der Aufgabe; eine zentrale Ortsverwaltung und Karte sind im Event Pass nicht enthalten.",
            light: "Ordne die Nachbereitungsaufgabe zuerst einem Bereich und einem zentral gepflegten Ort zu. Der Ort kann später auch in Schichten, Vorbereitung und Material verwendet werden. GPS-Punkte und die Live-Standortkarte gehören ab Pro dazu.",
            pro: "Ordne die Nachbereitungsaufgabe zuerst einem Bereich und einem zentral gepflegten Ort zu. In Pro und Enterprise kann derselbe Ort zusätzlich GPS-Daten und einen Platz auf der Live-Standortkarte erhalten.",
          };

  if (currentPackageId === "event_pass") {
    return {
      title:
        area === "plan"
          ? "Ort für die Schicht einordnen"
          : "Bereich und Ort zuerst einordnen",
      text: context.eventPass,
      audioKey: `${stepPrefix}-event-pass`,
    };
  }

  if (!productAllowsCapability(currentPackageId, "maps_gpx")) {
    return {
      title:
        area === "plan"
          ? "Zentral gepflegten Ort auswählen"
          : "Bereich und zentralen Ort wählen",
      text: context.light,
      audioKey: `${stepPrefix}-light`,
    };
  }

  return {
    title:
      area === "plan"
        ? "Ort mit Karte verknüpfen"
        : "Bereich, Ort und Karte einordnen",
    text: context.pro,
    audioKey: `${stepPrefix}-pro`,
  };
}

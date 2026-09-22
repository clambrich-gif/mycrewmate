const QUOTE_OPENERS = [
  "Heute gilt: ",
  "Für heute zählt: ",
  "Der heutige Impuls: ",
  "Gemeinsam merken wir uns: ",
  "Ein guter Gedanke für heute: ",
] as const;

const QUOTE_STEMS = [
  "Ein klarer Plan schafft Raum für gute Begegnungen.",
  "Viele kleine Zusagen ergeben ein starkes Team.",
  "Gute Vorbereitung macht den Eventtag leichter.",
  "Verlässlichkeit beginnt mit einer kurzen Rückmeldung.",
  "Gemeinsam findet sich für jede Aufgabe eine Lösung.",
  "Ein freundliches Wort ist oft der beste Start.",
  "Wer rechtzeitig fragt, hilft dem ganzen Team.",
  "Übersicht entsteht, wenn Informationen geteilt werden.",
  "Aus kleinen Schritten wächst ein gelungener Festivaltag.",
  "Ein Plan darf sich ändern und trotzdem Orientierung geben.",
  "Helfen heißt, Verantwortung miteinander zu teilen.",
  "Gut vorbereitet bleibt mehr Zeit für die schönen Momente.",
  "Eine offene Aufgabe ist eine Einladung zum Mitgestalten.",
  "Teamgeist zeigt sich besonders in den kleinen Dingen.",
  "Ein Danke macht Einsatz sichtbar.",
  "Jede Rückmeldung bringt den Plan ein Stück weiter.",
  "Sicherheit wächst, wenn alle Informationen am richtigen Ort stehen.",
  "Eine ruhige Minute Planung spart später viele Wege.",
  "Gemeinsam behalten wir auch an vollen Tagen den Überblick.",
  "Eine gut besetzte Schicht beginnt mit klarer Kommunikation.",
  "Freude am Event entsteht schon in der Vorbereitung.",
  "Ein freundlicher Empfang bleibt lange in Erinnerung.",
  "Wer zuhört, erkennt oft die beste nächste Aufgabe.",
  "Aus Organisation wird Gemeinschaft, wenn alle mitdenken.",
  "Jede helfende Hand macht den Unterschied.",
  "Ein kurzer Abgleich verhindert lange Umwege.",
  "Gute Ideen werden besser, wenn man sie teilt.",
  "Vertrauen wächst, wenn Absprachen eingehalten werden.",
  "Ein voller Plan braucht auch freie Atempausen.",
  "Heute vorbereitet, morgen entspannt im Einsatz.",
  "Auch eine kleine Aufgabe kann großen Rückenwind geben.",
  "Das beste Team arbeitet aufmerksam und miteinander.",
  "Ordnung im Material schafft Ruhe im Ablauf.",
  "Eine klare Ansprechperson schenkt Sicherheit.",
  "Jeder gute Eventtag beginnt mit einem guten Miteinander.",
  "Ein lächelndes Team ist die beste Visitenkarte.",
  "Flexibilität ist Stärke, wenn der Plan einmal anders läuft.",
  "Gute Planung lässt Platz für spontane Freude.",
  "Eine kurze Nachricht kann eine lange Unsicherheit beenden.",
  "Wer Verantwortung übernimmt, gestaltet Gemeinschaft.",
  "Aus einer Idee wird ein Fest, wenn viele sie tragen.",
  "Der nächste sinnvolle Schritt ist meist der wichtigste.",
  "Ein Blick auf den Plan kann den Tag retten.",
  "Ein abgestimmtes Team schafft entspannte Abläufe.",
  "Ein offenes Ohr ist Teil guter Organisation.",
  "Mit Übersicht wird auch ein großer Plan machbar.",
  "Jede Aufgabe hat ihren Platz und jede Hilfe ihren Wert.",
  "Ein gut gefüllter Helferplan schafft Gelassenheit.",
  "Gemeinsame Ziele verbinden mehr als lange To-do-Listen.",
  "Sorgfalt heute schafft Vertrauen für morgen.",
  "Ein Event lebt von Menschen, nicht nur von Listen.",
  "Zeit für einen kurzen Dank ist immer gut investiert.",
  "Wer den Überblick teilt, verdoppelt seine Wirkung.",
  "Eine Aufgabe nach der anderen ist auch ein guter Plan.",
  "Gemeinsam wird aus Aufwand ein Erlebnis.",
  "Klarheit ist ein Geschenk an das ganze Team.",
  "Ein gut vorbereiteter Arbeitsplatz macht Freude.",
  "Wenn alle wissen, was zählt, wird Zusammenarbeit leicht.",
  "Ein kleines Zeichen der Wertschätzung bewegt viel.",
  "Gute Organisation beginnt mit einem ehrlichen Ja oder Nein.",
  "Jede Erinnerung zur richtigen Zeit hilft weiter.",
  "Gemeinsames Handeln macht Herausforderungen kleiner.",
  "Ein sauberer Ablauf entsteht aus vielen guten Absprachen.",
  "Manchmal ist Nachfragen die beste Unterstützung.",
  "Verantwortung teilen heißt, Vertrauen zu zeigen.",
  "Ein übersichtlicher Plan gibt Raum für Herzlichkeit.",
  "Ein starkes Team erkennt man an seinem Zusammenhalt.",
  "Wer vorbereitet ist, kann den Moment genießen.",
  "Die beste Lösung entsteht oft im gemeinsamen Gespräch.",
  "Ein gelungener Tag beginnt mit einem klaren ersten Schritt.",
  "Ein bisschen Struktur schafft viel Freiheit.",
  "Zusammenhalt macht aus Planung echte Gemeinschaft.",
  "Ein gemeinsamer Blick nach vorn macht das Ziel greifbar.",
] as const;

/** Genau ein unterschiedlicher, gut lesbarer Gedanke für jeden Kalendertag. */
export const DAILY_DASHBOARD_QUOTES = Object.freeze(
  QUOTE_OPENERS.flatMap(opener => QUOTE_STEMS.map(stem => `${opener}${stem}`))
);

const DAYS_PER_ROTATION = DAILY_DASHBOARD_QUOTES.length;
const ROTATION_BASE_YEAR = 2026;
/** 137 ist teilerfremd zu 365 und durchläuft damit alle Sprüche, bevor er sich wiederholt. */
const YEARLY_SHIFT = 137;

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

/**
 * Liefert einen stabilen Tagesindex unabhängig von Zeitzonen. Der jährliche
 * Versatz verhindert, dass an wiederkehrenden Veranstaltungstagen derselbe
 * Spruch erneut erscheint.
 */
export function dashboardQuoteIndex(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  const referenceYear = 2025;
  const dayOfReferenceYear = Math.floor(
    (Date.UTC(referenceYear, month, day) - Date.UTC(referenceYear, 0, 1)) /
      86_400_000
  );
  const annualOffset = (date.getFullYear() - ROTATION_BASE_YEAR) * YEARLY_SHIFT;
  return positiveModulo(dayOfReferenceYear + annualOffset, DAYS_PER_ROTATION);
}

export function dashboardDailyQuote(date = new Date()) {
  return DAILY_DASHBOARD_QUOTES[dashboardQuoteIndex(date)];
}

if (DAILY_DASHBOARD_QUOTES.length !== 365) {
  throw new Error("Die tägliche Dashboard-Zitatrotation muss 365 Sprüche enthalten.");
}

if (new Set(DAILY_DASHBOARD_QUOTES).size !== DAILY_DASHBOARD_QUOTES.length) {
  throw new Error("Die tägliche Dashboard-Zitatrotation darf keine Dubletten enthalten.");
}

import { Hand } from "lucide-react";

export const KLEMMI_IMAGE_URL = "/api/klemmi/mascot";

/**
 * Kleine, bewusst selten animierte Klemmi-Darstellung für Auslöser.
 * Das eigentliche Maskottchen bleibt unverändert; die Hand ergänzt nur
 * die kurze, freundliche Aufmerksamkeitsgeste.
 */
export function KlemmiTriggerMascot() {
  return (
    <span className="klemmi-trigger-mascot relative block size-7 shrink-0" aria-hidden="true">
      <img src={KLEMMI_IMAGE_URL} alt="" className="size-7 rounded-md object-contain" />
      <Hand className="klemmi-trigger-wave absolute -right-2 -top-1 size-3.5 text-[#f3794a]" />
    </span>
  );
}

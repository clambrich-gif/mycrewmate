/**
 * Kurze, feste Klemmi-Sätze. Die jeweiligen Textfassungen und Audioassets
 * liegen im Klemmi-Audiokatalog; diese Listen halten Client und Server bei der
 * Auswahl synchron.
 */
export const KLEMMI_LOGIN_AUDIO_IDS = [
  "login-warmgelaufen",
  "login-chaos",
  "login-ehrenamt",
  "login-aermel",
  "login-kaffee",
  "login-tabellen",
  "login-druecker",
  "login-noch-eins",
  "login-datenbank",
  "login-system",
  "login-superhelden",
  "login-roter-teppich",
] as const;

export const KLEMMI_IDLE_AUDIO_IDS = [
  "idle-vorstehhund",
  "idle-kaffee",
  "idle-standbild",
  "idle-wuerstchenbude",
  "idle-singen",
] as const;

export const KLEMMI_ERROR_AUDIO_IDS = [
  "error-halt-stopp",
  "error-fast-perfekt",
  "error-zauberei",
  "error-rotes-feld",
  "error-verrats-keinem",
  "error-kleingedrucktes",
  "error-knapp-vorbei",
  "error-schranke",
] as const;

export const KLEMMI_SHIFT_SUCCESS_AUDIO_IDS = [
  "success-zack",
  "success-boom",
  "success-volltreffer",
  "success-reibungslos",
  "success-baem",
  "success-leerstand",
  "success-bilderbuch",
  "success-bingo",
  "success-high-five",
  "success-passt",
  "success-geschmiert",
  "success-arbeitslos",
] as const;

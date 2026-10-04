import * as React from "react";
import { cn } from "@/lib/utils";

export const KLEMMI_IMAGE_URL = "/api/klemmi/mascot";

type KlemmiMascotProps = {
  className?: string;
  imageClassName?: string;
  isSpeaking?: boolean;
  alt?: string;
  decorative?: boolean;
};

/**
 * Lokale 2D-Gesichtsebene für Klemmi. Die Ebenen liegen nur über dem bestehenden
 * Maskottchenbild und benötigen weder Video noch externe Daten. Augen schauen
 * dezent hin und her; der Mund bewegt sich ausschließlich während einer echten
 * Klemmi-Audioansage.
 */
export function KlemmiMascot({
  className,
  imageClassName,
  isSpeaking = false,
  alt = "Klemmi, der digitale Helfer",
  decorative = false,
}: KlemmiMascotProps) {
  return (
    <span
      className={cn("klemmi-animated-mascot relative isolate block", className)}
      data-klemmi-speaking={isSpeaking ? "true" : "false"}
      aria-hidden={decorative || undefined}
    >
      <img
        src={KLEMMI_IMAGE_URL}
        alt={decorative ? "" : alt}
        className={cn("size-full object-contain", imageClassName)}
      />
      <span className="klemmi-face-eye klemmi-face-eye--left" aria-hidden="true">
        <span className="klemmi-face-pupil" />
      </span>
      <span className="klemmi-face-eye klemmi-face-eye--right" aria-hidden="true">
        <span className="klemmi-face-pupil" />
      </span>
      <span className="klemmi-face-mouth-mask" aria-hidden="true">
        <span className="klemmi-face-mouth">
          <span className="klemmi-face-tongue" />
        </span>
      </span>
    </span>
  );
}

/** Kleine, ruhige Darstellung im Menü-Auslöser – ohne die frühere Handgeste. */
export function KlemmiTriggerMascot() {
  return (
    <span className="klemmi-trigger-mascot relative block size-7 shrink-0" aria-hidden="true">
      <img src={KLEMMI_IMAGE_URL} alt="" className="size-7 rounded-md object-contain" />
    </span>
  );
}

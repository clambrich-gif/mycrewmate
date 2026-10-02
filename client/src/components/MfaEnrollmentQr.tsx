import QRCode from "qrcode";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type MfaEnrollmentQrProps = {
  otpauthUri: string;
  alt: string;
  className?: string;
};

/**
 * Rendert einen QR-Code vollständig lokal im Browser. Der otpauth://-Inhalt
 * verlässt dabei weder den Browser noch MyCrewMate.
 */
export function MfaEnrollmentQr({
  otpauthUri,
  alt,
  className = "",
}: MfaEnrollmentQrProps) {
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setImage(null);
    setFailed(false);

    void QRCode.toDataURL(otpauthUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 288,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then(dataUrl => {
        if (active) setImage(dataUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [otpauthUri]);

  if (failed) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
        Der QR-Code konnte nicht erzeugt werden. Bitte Testsitzung neu starten.
      </p>
    );
  }

  if (!image) {
    return (
      <div className="grid size-72 place-items-center text-sm text-slate-500">
        <Loader2 className="size-5 animate-spin" /> QR-Code wird erzeugt …
      </div>
    );
  }

  return (
    <img
      src={image}
      alt={alt}
      className={`size-72 max-w-full rounded-lg bg-white p-2 shadow-sm ${className}`}
    />
  );
}

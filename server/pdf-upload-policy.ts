import { TRPCError } from "@trpc/server";
import { execFile } from "node:child_process";
import path from "node:path";

export const PDF_UPLOAD_POLICY_VERSION = "einvoice-xml-v1";
// One capped parser process per app instance. No synchronous work blocks Node;
// queued input remains bounded and overload fails closed before storage writes.
let active = false;
const waiters: Array<() => void> = [];
async function acquire() {
  if (!active) {
    active = true;
    return;
  }
  if (waiters.length >= 4)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Die PDF-Prüfung ist gerade ausgelastet. Bitte kurz warten und den Upload erneut versuchen.",
    });
  await new Promise<void>(resolve => waiters.push(resolve));
}
function release() {
  const next = waiters.shift();
  if (next) next();
  else active = false;
}

const messages: Record<string, string> = {
  password:
    "Passwortgeschützte PDFs können nicht hochgeladen werden. Bitte eine ungeschützte Rechnung verwenden.",
  active:
    "Diese PDF enthält aktive Aktionen oder Inhalte, die nicht zugelassen sind. Normale Links und geprüfte XML-E-Rechnungsdaten sind erlaubt.",
  attachment:
    "Diese PDF enthält einen nicht unterstützten Anhang. Erlaubt ist eine geprüfte XML-E-Rechnung, zum Beispiel xrechnung.xml, ohne weitere eingebettete Dateien.",
  attachment_limits:
    "Die eingebetteten E-Rechnungsdaten sind zu groß oder zu komplex. Bitte eine kleinere PDF-Rechnung verwenden.",
  limits:
    "Die PDF ist für die sichere Prüfung zu komplex. Bitte eine einfachere PDF-Rechnung verwenden.",
  invalid:
    "Die PDF konnte nicht vollständig geprüft werden. Bitte eine gültige, ungeschützte PDF-Rechnung verwenden.",
};

export async function inspectPdfUpload(bytes: Buffer): Promise<void> {
  await acquire();
  try {
    const response = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        process.env.PDF_INSPECTOR_PYTHON || "python3",
        ["-I", "-B", path.resolve("scripts/inspect-invoice-pdf.py")],
        {
          timeout: 8000,
          killSignal: "SIGKILL",
          maxBuffer: 16 * 1024,
          // The parser never needs application credentials or access to DB/mail.
          env: { PATH: process.env.PATH, LANG: "C.UTF-8" },
        },
        (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        }
      );
      child.stdin?.on("error", () => undefined);
      child.stdin?.end(bytes);
    });
    let result: { ok?: boolean; reason?: string; policyVersion?: string };
    try {
      result = JSON.parse(response);
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: messages.invalid });
    }
    if (result.ok !== true)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: messages[result.reason || "invalid"] || messages.invalid,
      });
    if (result.policyVersion !== PDF_UPLOAD_POLICY_VERSION)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Die PDF-Prüfung ist momentan nicht verfügbar. Bitte den Upload später erneut versuchen.",
      });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    // Do not emit stderr, filenames, XML data or parser tracebacks into logs/UI.
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Die PDF konnte nicht sicher geprüft werden. Bitte den Upload erneut versuchen oder eine einfachere PDF verwenden.",
    });
  } finally {
    release();
  }
}

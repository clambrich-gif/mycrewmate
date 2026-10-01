import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { downloadBase64File } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { FileLock2, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRoute } from "wouter";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,80}$/;

export default function ProtectedHelperPdfShare() {
  const [, params] = useRoute("/freigabe/:token");
  const token = params?.token ?? "";
  const [accessCode, setAccessCode] = useState("");
  const openShare = trpc.pdf.openWhatsAppShare.useMutation();
  const validToken = TOKEN_PATTERN.test(token);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validToken || openShare.isPending) return;
    try {
      const result = await openShare.mutateAsync({
        token,
        accessCode: accessCode.trim().toUpperCase(),
      });
      downloadBase64File(result.base64, result.mimeType, result.filename);
    } catch {
      // Die tRPC-Fehlermeldung wird direkt im Formular gezeigt, damit nicht
      // offengelegt wird, ob Link, Ablauf oder Zugangscode die Ursache war.
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:py-16">
      <div className="mx-auto max-w-lg">
        <div className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold text-blue-900">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          MyCrewMate · Geschützter Einsatzplan
        </div>
        <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
              <FileLock2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl">
              Persönlichen Einsatzplan öffnen
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed text-slate-600">
              Gib den zwölfstelligen Zugangscode ein, der zusammen mit diesem
              Link in deiner WhatsApp-Nachricht steht. Der Abruf ist zeitlich
              begrenzt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!validToken ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                Dieser Einsatzplan ist nicht verfügbar.
              </div>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <label
                    htmlFor="share-access-code"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Zugangscode
                  </label>
                  <Input
                    id="share-access-code"
                    autoComplete="one-time-code"
                    inputMode="text"
                    maxLength={12}
                    placeholder="z. B. A1B2C3D4E5F6"
                    value={accessCode}
                    onChange={event =>
                      setAccessCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                      )
                    }
                    className="h-12 font-mono text-base tracking-[0.12em]"
                  />
                </div>
                {openShare.isError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    Dieser Einsatzplan ist nicht verfügbar oder der Zugangscode
                    ist falsch.
                  </p>
                )}
                <Button
                  type="submit"
                  className="h-12 w-full bg-blue-800 text-white hover:bg-blue-900"
                  disabled={openShare.isPending || accessCode.length !== 12}
                >
                  {openShare.isPending
                    ? "Einsatzplan wird vorbereitet …"
                    : "Einsatzplan herunterladen"}
                </Button>
              </form>
            )}
            <p className="mt-5 text-xs leading-relaxed text-slate-500">
              Link und Zugangscode sind für dich bestimmt. Bitte leite beides
              nicht weiter.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

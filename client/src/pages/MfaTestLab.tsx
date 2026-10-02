import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { MfaEnrollmentQr } from "@/components/MfaEnrollmentQr";
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

function isAllowedPreviewHost() {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.trim().toLowerCase().replace(/\.$/, "");
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".manus.computer")
  );
}

function formatExpiry(value: Date | null) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

/**
 * Isoliertes MFA-Testlabor: Es verwendet ausschließlich kurzlebige
 * In-Memory-Testschlüssel. Weder Live-Datenbank, Login-Sitzungen noch ein
 * Benutzerkonto können hier verändert werden.
 */
export default function MfaTestLab() {
  const allowed = isAllowedPreviewHost();
  const [testSessionToken, setTestSessionToken] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const begin = trpc.auth.mfaTestBegin.useMutation({
    onSuccess: result => {
      setTestSessionToken(result.testSessionToken);
      setOtpauthUri(result.otpauthUri);
      setExpiresAt(result.expiresAt);
      setCode("");
      setMessage(null);
      setVerified(false);
    },
    onError: error => setMessage(error.message),
  });
  const verify = trpc.auth.mfaTestVerify.useMutation({
    onSuccess: result => {
      if (result.valid) {
        setVerified(true);
        setMessage("Scan und zeitbasierter Einmalcode wurden erfolgreich geprüft.");
        return;
      }
      setVerified(false);
      setMessage(
        result.reason === "expired"
          ? "Die Testsession ist abgelaufen. Bitte eine neue Testsitzung starten."
          : "Der sechsstellige Code passt nicht. Bitte prüfen Sie den App-Eintrag und warten Sie bei Bedarf auf den nächsten Code."
      );
    },
    onError: error => setMessage(error.message),
  });

  const expiresText = useMemo(() => formatExpiry(expiresAt), [expiresAt]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!testSessionToken || !/^\d{6}$/.test(code.trim())) return;
    verify.mutate({ testSessionToken, code: code.trim() });
  };

  if (!allowed) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4 text-slate-950">
        <Card className="w-full max-w-xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-slate-700" /> MFA-Testlabor</CardTitle>
            <CardDescription>
              Diese Ansicht ist ausschließlich in der isolierten Manus-/Local-Vorschau verfügbar und auf Produktivdomains bewusst deaktiviert.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_8%_8%,rgba(219,234,254,0.95),transparent_34%),radial-gradient(circle_at_95%_92%,rgba(224,242,254,0.72),transparent_32%),#f8fafc] px-4 py-8 text-slate-950 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-2xl border border-blue-200 bg-white/95 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">Isolierte Vorschau</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl"><ShieldCheck className="size-7 text-blue-700" /> MFA-Testlabor</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Testen Sie den QR-Scan mit Ihrer Authenticator-App risikofrei. Diese Testsitzung ist nur zehn Minuten gültig und berührt weder den Live-Masterzugang noch Datenbank, Passwörter oder Wiederherstellungscodes.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><CheckCircle2 className="size-3.5" /> Keine Live-Aktivierung</span>
          </div>
        </header>

        {!testSessionToken ? (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Testsitzung starten</CardTitle>
              <CardDescription>Ein frischer Testschlüssel wird nur im Speicher der Vorschau erzeugt und nach zehn Minuten automatisch verworfen.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={() => begin.mutate()} disabled={begin.isPending}>
                {begin.isPending ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
                QR-Test starten
              </Button>
              {message && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{message}</p>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Camera className="size-5 text-blue-700" /> 1. QR-Code mit der Authenticator-App scannen</CardTitle>
                <CardDescription>In Google Authenticator, Microsoft Authenticator, 1Password oder einer vergleichbaren App „QR-Code scannen“ wählen.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                  {otpauthUri ? (
                    <MfaEnrollmentQr otpauthUri={otpauthUri} alt="QR-Code für die temporäre MFA-Testsession" />
                  ) : (
                    <div className="grid size-72 place-items-center text-sm text-slate-500">
                      <Loader2 className="size-5 animate-spin" /> QR-Code wird erzeugt …
                    </div>
                  )}
                </div>
                <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-950"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-700" /> Der QR-Code enthält nur einen einmaligen, kurzlebigen Testsitzungsschlüssel. Er ist kein Zugang zu MyCrewMate.</p>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">2. Aktuellen App-Code prüfen</CardTitle><CardDescription>Nach dem Scan zeigt die App einen sechsstelligen Code.</CardDescription></CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={submit}>
                    <Input
                      aria-label="Sechsstelliger Authenticator-Code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={event => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setMessage(null); }}
                      placeholder="123456"
                      disabled={verified || verify.isPending}
                      className="h-12 text-center font-mono text-lg tracking-[0.3em]"
                    />
                    <Button className="w-full" type="submit" disabled={!/^\d{6}$/.test(code) || verified || verify.isPending}>
                      {verify.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                      Code prüfen
                    </Button>
                  </form>
                  {message && <p className={`mt-3 rounded-lg border px-3 py-2 text-sm leading-5 ${verified ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`} role="status">{message}</p>}
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="space-y-3 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Clock3 className="size-4 text-slate-600" /> Gültig bis {expiresText} Uhr</p>
                  <p className="text-xs leading-5 text-slate-600">Danach ist der Schlüssel automatisch unbrauchbar. Eine neue Testsitzung erzeugt einen komplett neuen QR-Code.</p>
                  <Button type="button" variant="outline" className="w-full" onClick={() => begin.mutate()} disabled={begin.isPending || verify.isPending}>
                    {begin.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Neue Testsitzung
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

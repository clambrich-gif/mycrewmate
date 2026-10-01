import { Button } from "@/components/ui/button";
import { APP_LOGIN_URL } from "@/lib/site-host";
import {
  LEGAL_DOCUMENTS,
  type LegalDocumentId,
} from "@shared/legal-contract-documents";
import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "wouter";

const WORDMARK = "/brand/mycrewmate-wordmark.png";

function renderDocumentContent(content: string) {
  return content
    .split("\n\n")
    .filter(Boolean)
    .map((block, index) => {
      if (block.startsWith("# ")) {
        return (
          <h1 key={index} className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {block.slice(2)}
          </h1>
        );
      }
      if (block.startsWith("## ")) {
        return (
          <h2 key={index} className="pt-3 text-base font-bold text-slate-950">
            {block.slice(3)}
          </h2>
        );
      }
      if (block.startsWith("- ")) {
        return (
          <ul key={index} className="list-disc space-y-1 pl-5">
            {block.split("\n").map(item => (
              <li key={item}>{item.replace(/^-\s*/, "")}</li>
            ))}
          </ul>
        );
      }
      return (
        <p key={index} className="whitespace-pre-line">
          {block}
        </p>
      );
    });
}

export default function LegalDocument({ documentId }: { documentId: LegalDocumentId }) {
  const document = LEGAL_DOCUMENTS[documentId];
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50/80 text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="https://mycrewmate.de" className="shrink-0" aria-label="MyCrewMate – zur Startseite">
            <img src={WORDMARK} alt="MyCrewMate" className="h-8 w-auto sm:h-9" />
          </a>
          <a href={APP_LOGIN_URL}>
            <Button type="button" className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
              Zum Login
            </Button>
          </a>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <ArrowLeft className="size-4" aria-hidden="true" /> Zurück zur Produktseite
        </Link>
        <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <div className="mb-7 flex items-center gap-3 text-blue-700">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-50"><FileText className="size-5" aria-hidden="true" /></span>
            <p className="text-sm font-semibold">Verbindliche Dokumentversion: {document.version}</p>
          </div>
          <div className="space-y-5 text-sm leading-7 text-slate-700">
            {renderDocumentContent(document.content)}
          </div>
        </article>
      </section>
    </main>
  );
}

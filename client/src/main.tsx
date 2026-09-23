import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import {
  storedEventId,
  storedEventYear,
  storedTenantId,
} from "./contexts/YearContext";
import { installMobileFocusViewportGuard } from "./lib/mobileFocusViewport";
import { getPreviewSessionToken } from "./lib/preview-session";

const queryClient = new QueryClient();

installMobileFocusViewportGuard();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Die Anwendung bleibt auch ohne Offline-Cache vollständig nutzbar.
    });
  });
}

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    const mutationKey = event.mutation.options.mutationKey;
    const mutationKeyParts = Array.isArray(mutationKey)
      ? mutationKey.flat(Infinity).filter(
          (part): part is string => typeof part === "string"
        )
      : [];
    const keyPath = mutationKeyParts.join(".");
    const isHandledPasswordLogin =
      keyPath === "auth.passwordLogin" ||
      keyPath === "auth.adminPasswordLogin";
    // Falsche Zugangsdaten sind eine erwartete Formulareingabe und werden
    // direkt im Login angezeigt, nicht als technischer API-Fehler gesammelt.
    if (isHandledPasswordLogin) return;
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const previewSessionToken = getPreviewSessionToken();
        const tenantId = storedTenantId();
        return {
          "x-tenant-id": tenantId,
          "x-event-year": String(storedEventYear()),
          "x-event-id": String(storedEventId(storedEventYear(), tenantId)),
          ...(previewSessionToken
            ? { Authorization: `Bearer ${previewSessionToken}` }
            : {}),
        };
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

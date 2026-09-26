import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Nach einem Deployment kann ein bereits offener Tab noch auf einen durch den
// neuen Build ersetzten, gehashten Lazy-Route-Chunk verweisen. Ein einmaliges
// Neuladen holt den aktuellen Einstiegspunkt. Der Schlüssel bleibt bis zu
// einem erfolgreichen App-Start bestehen und verhindert damit Reload-Schleifen.
const LAZY_ROUTE_RELOAD_KEY = "mycrewmate:lazy-route-reload";

export function isLazyRouteChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk [\w-]+ failed/i.test(
    message
  );
}

function reloadOnceForLazyRouteChunk(error: unknown) {
  if (typeof window === "undefined" || !isLazyRouteChunkError(error)) return false;

  const currentUrl = window.location.href;
  try {
    if (window.sessionStorage.getItem(LAZY_ROUTE_RELOAD_KEY) === currentUrl) {
      return false;
    }
    window.sessionStorage.setItem(LAZY_ROUTE_RELOAD_KEY, currentUrl);
  } catch {
    // Wenn Session Storage durch eine Browserrichtlinie blockiert ist, bleibt
    // die reguläre Fehleransicht sichtbar statt unkontrolliert neu zu laden.
    return false;
  }

  window.location.reload();
  return true;
}

/** Wird nach einem erfolgreichen Rendern aufgerufen und erlaubt spätere Deployments. */
export function clearLazyRouteReloadAttempt() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(LAZY_ROUTE_RELOAD_KEY);
  } catch {
    // Nicht kritisch: Die Fehlergrenze bleibt weiterhin vollständig nutzbar.
  }
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    reloadOnceForLazyRouteChunk(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

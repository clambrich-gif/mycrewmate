import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyBrowserBranding } from "@/lib/browser-branding";
import {
  appUrlForCurrentLocation,
  isMarketingSite,
  isMasterAdminSite,
} from "@/lib/site-host";
import { lazy, Suspense, useEffect } from "react";
import { useRef } from "react";
import { Redirect, Route, Switch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import ErrorBoundary, {
  clearLazyRouteReloadAttempt,
} from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { YearProvider } from "./contexts/YearContext";
import { routeLoaders } from "./lib/route-loaders";
import { useAuth } from "./_core/hooks/useAuth";
import { useTenantAdministration } from "@/hooks/useTenantAdministration";
import { useEventYear } from "./contexts/YearContext";

/**
 * Aktive Arbeitsansichten werden bewusst im kurzen, aber ressourcenschonenden
 * Takt abgeglichen. Lokale Mutationen bleiben sofort sichtbar; parallel
 * geöffnete Bildschirme erhalten ihre Änderungen spätestens nach acht Sekunden.
 */
export const PLANNING_DATA_SYNC_INTERVAL_MS = 8_000;

function PlanningDataSynchronizer({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { tenantId, year, eventId } = useEventYear();
  const queryClient = useQueryClient();
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshVisiblePlanningData = async () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
        // Ausschließlich gerade sichtbare Abfragen werden neu geladen. Dadurch
        // bleiben nicht geöffnete Bereiche vollständig inaktiv.
        await queryClient.refetchQueries({ type: "active" });
      } finally {
        syncInFlightRef.current = false;
      }
    };

    const timer = window.setInterval(
      refreshVisiblePlanningData,
      PLANNING_DATA_SYNC_INTERVAL_MS
    );
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") {
        void refreshVisiblePlanningData();
      }
    };
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [eventId, isAuthenticated, queryClient, tenantId, year]);

  return <>{children}</>;
}

const Dashboard = lazy(routeLoaders["/"]);
const Contacts = lazy(routeLoaders["/ansprechpartner"]);
const Locations = lazy(routeLoaders["/orte"]);
const Helpers = lazy(routeLoaders["/helfer"]);
const Plan = lazy(routeLoaders["/einsatzplan"]);
const Preparation = lazy(routeLoaders["/vorbereitung"]);
const PostProcessing = lazy(routeLoaders["/nachbereitung"]);
const Materials = lazy(routeLoaders["/material"]);
const Donations = lazy(routeLoaders["/spenden"]);
const Finances = lazy(routeLoaders["/finanzen"]);
const PdfExport = lazy(routeLoaders["/pdf-export"]);
const Security = lazy(routeLoaders["/sicherheit"]);
const Help = lazy(routeLoaders["/hilfe"]);
const OfferDemo = lazy(() => import("@/pages/OfferDemo"));
const PublicLegalPage = lazy(() => import("@/pages/PublicLegal"));
const MasterAdminPortal = lazy(() => import("@/pages/MasterAdminPortal"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function RouteLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-label="Seite wird geladen"
    >
      <div className="h-8 w-52 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border bg-card"
          />
        ))}
      </div>
      <span className="sr-only">Seite wird geladen …</span>
    </div>
  );
}

function AdminOnlySecurityRedirect() {
  const { loading } = useAuth();
  const { isTenantAdmin, administrativeContext } = useTenantAdministration();

  if (loading || administrativeContext.isLoading) return <RouteLoading />;
  if (!isTenantAdmin) return <Redirect to="/" />;
  return <Redirect to="/sicherheit" />;
}

/**
 * Die öffentliche Hauptdomain zeigt ausschließlich die Angebotsseite.
 * Unbekannte Pfade werden auf die gleichlautende, geschützte App-Subdomain
 * geleitet, damit historische App-Links weiterhin eine sichere Zieladresse haben.
 */
function PublicAppRedirect() {
  useEffect(() => {
    window.location.replace(appUrlForCurrentLocation());
  }, []);

  return <RouteLoading />;
}

function PublicSiteRouter() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path="/" component={OfferDemo} />
        <Route path="/impressum">
          <PublicLegalPage kind="impressum" />
        </Route>
        <Route path="/datenschutz">
          <PublicLegalPage kind="datenschutz" />
        </Route>
        <Route component={PublicAppRedirect} />
      </Switch>
    </Suspense>
  );
}

/** Die spätere Master-Domain besitzt bewusst keine Vereinsnavigation. */
function MasterAdminRouter() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path="/" component={MasterAdminPortal} />
      </Switch>
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      {/* Nur lokale/Manus-Vorschauen können das Masterportal über diesen Pfad testen.
          Auf admin.mycrewmate.de wird MasterAdminRouter direkt am Root gerendert. */}
      <Route path="/master-admin" component={MasterAdminPortal} />
      <Route path="/angebot-demo">
        <Suspense fallback={<RouteLoading />}>
          <OfferDemo />
        </Suspense>
      </Route>
      <Route>
        <Layout>
          <Suspense fallback={<RouteLoading />}>
        <Switch>
          {/* Das Passwortformular wird vom Layout für nicht angemeldete Personen angezeigt.
              Nach einer erfolgreichen Anmeldung darf /login jedoch nicht in die 404 fallen. */}
          <Route path="/login">
            <Redirect to="/" />
          </Route>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/" component={Dashboard} />
          <Route path="/ansprechpartner" component={Contacts} />
          <Route path="/orte" component={Locations} />
          <Route path="/helfer" component={Helpers} />
          <Route path="/einsatzplan" component={Plan} />
          <Route path="/vorbereitung" component={Preparation} />
          <Route path="/nachbereitung" component={PostProcessing} />
          <Route path="/material" component={Materials} />
          <Route path="/marketing">
            <Redirect to="/vorbereitung" />
          </Route>
          <Route path="/genehmigungen">
            <Redirect to="/vorbereitung" />
          </Route>
          <Route path="/spenden" component={Donations} />
          <Route path="/kuchen">
            <Redirect to="/spenden" />
          </Route>
          <Route path="/finanzen" component={Finances} />
          <Route path="/pdf-export" component={PdfExport} />
          <Route path="/berechtigungen" component={AdminOnlySecurityRedirect} />
          <Route path="/sicherheit" component={Security} />
          <Route path="/hilfe" component={Help} />
          <Route component={NotFound} />
        </Switch>
          </Suspense>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  const marketingSite = isMarketingSite();
  const masterAdminSite = isMasterAdminSite();

  useEffect(() => {
    applyBrowserBranding();
    // Ein vollständig gestarteter App-Entry bestätigt die aktuelle
    // Asset-Version und macht die einmalige Chunk-Recovery für einen späteren
    // Deploymentwechsel wieder verfügbar.
    clearLazyRouteReloadAttempt();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" forcedTheme="light">
        <TooltipProvider>
          <Toaster />
          {masterAdminSite ? (
            <MasterAdminRouter />
          ) : marketingSite ? (
            <PublicSiteRouter />
          ) : (
            <YearProvider>
              <PlanningDataSynchronizer>
                <Router />
              </PlanningDataSynchronizer>
            </YearProvider>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { YearProvider } from "./contexts/YearContext";
import { routeLoaders } from "./lib/route-loaders";

const Dashboard = lazy(routeLoaders["/"]);
const Contacts = lazy(routeLoaders["/ansprechpartner"]);
const Helpers = lazy(routeLoaders["/helfer"]);
const Plan = lazy(routeLoaders["/einsatzplan"]);
const TaskList = lazy(routeLoaders["/vorbereitung"]);
const Materials = lazy(routeLoaders["/material"]);
const Marketing = lazy(routeLoaders["/marketing"]);
const Approvals = lazy(routeLoaders["/genehmigungen"]);
const Cakes = lazy(routeLoaders["/kuchen"]);
const Finances = lazy(routeLoaders["/finanzen"]);
const PdfExport = lazy(routeLoaders["/pdf-export"]);
const Excel = lazy(routeLoaders["/excel"]);
const Permissions = lazy(routeLoaders["/berechtigungen"]);
const Security = lazy(routeLoaders["/sicherheit"]);
const Help = lazy(routeLoaders["/hilfe"]);
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

function Router() {
  return (
    <Layout>
      <Suspense fallback={<RouteLoading />}>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/" component={Dashboard} />
          <Route path="/ansprechpartner" component={Contacts} />
          <Route path="/helfer" component={Helpers} />
          <Route path="/einsatzplan" component={Plan} />
          <Route path="/vorbereitung">
            {() => <TaskList kind="prep" title="Vorbereitung" />}
          </Route>
          <Route path="/nachbereitung">
            {() => <TaskList kind="post" title="Nachbereitung" />}
          </Route>
          <Route path="/material" component={Materials} />
          <Route path="/marketing" component={Marketing} />
          <Route path="/genehmigungen" component={Approvals} />
          <Route path="/kuchen" component={Cakes} />
          <Route path="/finanzen" component={Finances} />
          <Route path="/pdf-export" component={PdfExport} />
          <Route path="/excel" component={Excel} />
          <Route path="/berechtigungen" component={Permissions} />
          <Route path="/sicherheit" component={Security} />
          <Route path="/hilfe" component={Help} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" forcedTheme="light">
        <TooltipProvider>
          <Toaster />
          <YearProvider>
            <Router />
          </YearProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

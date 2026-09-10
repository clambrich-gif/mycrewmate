import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Helpers from "./pages/Helpers";
import Plan from "./pages/Plan";
import TaskList from "./pages/TaskList";
import Materials from "./pages/Materials";
import Marketing from "./pages/Marketing";
import Approvals from "./pages/Approvals";
import Cakes from "./pages/Cakes";
import Finances from "./pages/Finances";
import Excel from "./pages/Excel";
import PdfExport from "./pages/PdfExport";
import Security from "./pages/Security";
import Permissions from "./pages/Permissions";
import { YearProvider } from "./contexts/YearContext";

function Router() {
  return (
    <Layout>
      <Switch>
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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
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

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import Exports from "@/pages/exports";
import Research from "@/pages/research";
import ResearchSchedulingPage from "@/pages/ResearchSchedulingPage";
import Diagnostics from "@/pages/diagnostics";
import AIVerification from "@/pages/ai-verification";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/exports" component={Exports} />
      <Route path="/research" component={Research} />
      <Route path="/scheduling" component={ResearchSchedulingPage} />
      <Route path="/diagnostics" component={Diagnostics} />
      <Route path="/ai-verification" component={AIVerification} />
      <Route path="/verification" component={AIVerification} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

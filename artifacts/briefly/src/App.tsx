import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { useAuth } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";

import { Login } from "@/pages/login";
import { Dashboard } from "@/pages/dashboard";
import { Collections } from "@/pages/collections";
import { CollectionDetail } from "@/pages/collection-detail";
import { NoteDetail } from "@/pages/note-detail";
import { Search } from "@/pages/search";
import { Settings } from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/collections" component={Collections} />
        <Route path="/collections/:id" component={CollectionDetail} />
        <Route path="/notes/:id" component={NoteDetail} />
        <Route path="/search" component={Search} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

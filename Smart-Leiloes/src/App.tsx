import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Agendar from "./pages/Agendar.tsx";
import Confirmacao from "./pages/Confirmacao.tsx";
import Tratativas from "./pages/Tratativas.tsx";
import Painel from "./pages/Painel.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/agendar" element={<ProtectedRoute allow={["parceiro", "gerente"]}><Agendar /></ProtectedRoute>} />
              <Route path="/confirmacao/:protocol" element={<ProtectedRoute><Confirmacao /></ProtectedRoute>} />
              <Route path="/tratativas" element={<ProtectedRoute allow={["parceiro", "proprietario"]}><Tratativas /></ProtectedRoute>} />
              <Route path="/painel" element={<ProtectedRoute><Painel /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute allow={["admin"]}><Admin /></ProtectedRoute>} />
              <Route path="/admin/dashboard" element={<ProtectedRoute allow={["admin"]}><AdminDashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

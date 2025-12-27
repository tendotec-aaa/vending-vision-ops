import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Locations from "./pages/Locations";
import VisitReports from "./pages/VisitReports";
import NewVisitReport from "./pages/NewVisitReport";
import Profile from "./pages/Profile";
import RoutesPage from "./pages/Routes";
import MaintenanceLog from "./pages/MaintenanceLog";
import Machines from "./pages/Machines";
import Setups from "./pages/Setups";
import WarehouseComponents from "./pages/WarehouseComponents";
import WarehouseProducts from "./pages/WarehouseProducts";
import ProductDetail from "./pages/ProductDetail";
import Suppliers from "./pages/Suppliers";
import Purchases from "./pages/Purchases";
import NewPurchase from "./pages/NewPurchase";
import Compliance from "./pages/Compliance";
import CustomerFeedback from "./pages/CustomerFeedback";
import MarketingPromotions from "./pages/MarketingPromotions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
            <Route path="/visit-reports" element={<ProtectedRoute><VisitReports /></ProtectedRoute>} />
            <Route path="/visit-report/new" element={<ProtectedRoute><NewVisitReport /></ProtectedRoute>} />
            <Route path="/routes" element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
            <Route path="/maintenance" element={<ProtectedRoute><MaintenanceLog /></ProtectedRoute>} />
            <Route path="/machines" element={<ProtectedRoute><Machines /></ProtectedRoute>} />
            <Route path="/setups" element={<ProtectedRoute><Setups /></ProtectedRoute>} />
            <Route path="/warehouse/components" element={<ProtectedRoute><WarehouseComponents /></ProtectedRoute>} />
            <Route path="/warehouse/products" element={<ProtectedRoute><WarehouseProducts /></ProtectedRoute>} />
            <Route path="/warehouse/products/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
            <Route path="/purchases" element={<ProtectedRoute><Purchases /></ProtectedRoute>} />
            <Route path="/purchases/new" element={<ProtectedRoute><NewPurchase /></ProtectedRoute>} />
            <Route path="/compliance" element={<ProtectedRoute><Compliance /></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute><CustomerFeedback /></ProtectedRoute>} />
            <Route path="/promotions" element={<ProtectedRoute><MarketingPromotions /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

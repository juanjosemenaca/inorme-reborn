import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { PasswordChangeGate } from "@/components/admin/PasswordChangeGate";
import { RoleRoute } from "@/components/admin/RoleRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUsersBulk from "./pages/admin/AdminUsersBulk";
import AdminClients from "./pages/admin/AdminClients";
import AdminProjects from "./pages/admin/AdminProjects";
import AdminProviders from "./pages/admin/AdminProviders";
import AdminCompanyWorkers from "./pages/admin/AdminCompanyWorkers";
import AdminWorkCalendars from "./pages/admin/AdminWorkCalendars";
import AdminVacations from "./pages/admin/AdminVacations";
import AdminVacationRequests from "./pages/admin/AdminVacationRequests";
import AdminChangePassword from "./pages/admin/AdminChangePassword";
import WorkerMyProfile from "./pages/admin/WorkerMyProfile";
import WorkerMyCalendar from "./pages/admin/WorkerMyCalendar";
import WorkerMessages from "./pages/admin/WorkerMessages";
import AdminWorkerProfileRequests from "./pages/admin/AdminWorkerProfileRequests";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AdminAuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <PasswordChangeGate>
                      <AdminLayout />
                    </PasswordChangeGate>
                  </ProtectedRoute>
                }
              >
                <Route path="cambiar-contrasena" element={<AdminChangePassword />} />
                <Route
                  path="mi-ficha"
                  element={
                    <RoleRoute allowedRoles={["WORKER"]}>
                      <WorkerMyProfile />
                    </RoleRoute>
                  }
                />
                <Route
                  path="mi-calendario"
                  element={
                    <RoleRoute allowedRoles={["WORKER"]}>
                      <WorkerMyCalendar />
                    </RoleRoute>
                  }
                />
                <Route
                  path="mensajes"
                  element={
                    <RoleRoute allowedRoles={["WORKER"]}>
                      <WorkerMessages />
                    </RoleRoute>
                  }
                />
                <Route
                  path="solicitudes-ficha"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminWorkerProfileRequests />
                    </RoleRoute>
                  }
                />
                <Route index element={<AdminDashboard />} />
                <Route
                  path="usuarios/alta-masiva"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminUsersBulk />
                    </RoleRoute>
                  }
                />
                <Route
                  path="usuarios"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminUsers />
                    </RoleRoute>
                  }
                />
                <Route
                  path="clientes"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminClients />
                    </RoleRoute>
                  }
                />
                <Route
                  path="proyectos"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminProjects />
                    </RoleRoute>
                  }
                />
                <Route
                  path="proveedores"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminProviders />
                    </RoleRoute>
                  }
                />
                <Route
                  path="trabajadores"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminCompanyWorkers />
                    </RoleRoute>
                  }
                />
                <Route
                  path="calendarios-laborales"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminWorkCalendars />
                    </RoleRoute>
                  }
                />
                <Route
                  path="vacaciones"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminVacations />
                    </RoleRoute>
                  }
                />
                <Route
                  path="solicitudes-vacaciones"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminVacationRequests />
                    </RoleRoute>
                  }
                />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AdminAuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import AdminWorkerMessages from "./pages/admin/AdminWorkerMessages";
import AdminWorkerProfileRequests from "./pages/admin/AdminWorkerProfileRequests";
import WorkerTimeClockLayout from "./pages/admin/WorkerTimeClockLayout";
import WorkerTimeClockFichar from "./pages/admin/WorkerTimeClockFichar";
import WorkerTimeClockCorrection from "./pages/admin/WorkerTimeClockCorrection";
import WorkerTimeClockHistory from "./pages/admin/WorkerTimeClockHistory";
import AdminTimeClock from "./pages/admin/AdminTimeClock";
import AdminTimeClockRequests from "./pages/admin/AdminTimeClockRequests";
import AdminTimeClockReports from "./pages/admin/AdminTimeClockReports";
import AdminUserModuleActivation from "./pages/admin/AdminUserModuleActivation";
import WorkerAgenda from "./pages/admin/WorkerAgenda";
import AdminWorkerAgenda from "./pages/admin/AdminWorkerAgenda";
import WorkerExpenses from "./pages/admin/WorkerExpenses";
import AdminWorkerExpenses from "./pages/admin/AdminWorkerExpenses";
import { ADMIN_ROUTE_SEG } from "@/constants/adminPaths";

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
                    <RoleRoute allowedRoles={["WORKER", "ADMIN"]}>
                      <WorkerMyProfile />
                    </RoleRoute>
                  }
                />
                <Route
                  path="mi-calendario"
                  element={
                    <RoleRoute allowedRoles={["WORKER", "ADMIN"]} requiredModule="VACATIONS">
                      <WorkerMyCalendar />
                    </RoleRoute>
                  }
                />
                <Route
                  path="mi-agenda"
                  element={
                    <RoleRoute allowedRoles={["WORKER", "ADMIN"]} requiredModule="AGENDA">
                      <WorkerAgenda />
                    </RoleRoute>
                  }
                />
                <Route
                  path="mis-gastos"
                  element={
                    <RoleRoute allowedRoles={["WORKER", "ADMIN"]} requiredModule="GASTOS">
                      <WorkerExpenses />
                    </RoleRoute>
                  }
                />
                <Route
                  path={ADMIN_ROUTE_SEG.gastosTrabajadores}
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminWorkerExpenses />
                    </RoleRoute>
                  }
                />
                <Route
                  path="agendas-trabajadores"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminWorkerAgenda />
                    </RoleRoute>
                  }
                />
                <Route
                  path="mensajes-trabajadores"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminWorkerMessages />
                    </RoleRoute>
                  }
                />
                <Route
                  path="mensajes"
                  element={
                    <RoleRoute allowedRoles={["WORKER", "ADMIN"]} requiredModule="MESSAGES">
                      <WorkerMessages />
                    </RoleRoute>
                  }
                />
                <Route
                  path="fichajes"
                  element={
                    <RoleRoute allowedRoles={["WORKER", "ADMIN"]} requiredModule="TIME_CLOCK">
                      <WorkerTimeClockLayout />
                    </RoleRoute>
                  }
                >
                  <Route index element={<Navigate to="fichar" replace />} />
                  <Route path="fichar" element={<WorkerTimeClockFichar />} />
                  <Route path="correccion" element={<WorkerTimeClockCorrection />} />
                  <Route path="historial" element={<WorkerTimeClockHistory />} />
                </Route>
                <Route
                  path="control-fichajes"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminTimeClock />
                    </RoleRoute>
                  }
                />
                <Route
                  path="control-fichajes/informes"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminTimeClockReports />
                    </RoleRoute>
                  }
                />
                <Route
                  path={ADMIN_ROUTE_SEG.solicitudesFichajes}
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminTimeClockRequests />
                    </RoleRoute>
                  }
                />
                <Route
                  path={ADMIN_ROUTE_SEG.solicitudesFicha}
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminWorkerProfileRequests />
                    </RoleRoute>
                  }
                />
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
                  path="usuarios/activacion-modulos"
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminUserModuleActivation />
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
                  path={ADMIN_ROUTE_SEG.solicitudesVacaciones}
                  element={
                    <RoleRoute allowedRoles={["ADMIN"]}>
                      <AdminVacationRequests />
                    </RoleRoute>
                  }
                />
                <Route index element={<AdminDashboard />} />
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

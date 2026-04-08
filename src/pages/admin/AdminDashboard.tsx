import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminDashboardAdmin } from "@/components/admin/AdminDashboardAdmin";
import { WorkerDashboard } from "@/components/admin/WorkerDashboard";

const AdminDashboard = () => {
  const { user, isAdmin, isWorker } = useAdminAuth();

  if (isAdmin && user) {
    return <AdminDashboardAdmin session={user} />;
  }

  if (isWorker) {
    return <WorkerDashboard />;
  }

  return null;
};

export default AdminDashboard;

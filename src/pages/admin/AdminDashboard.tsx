import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminDashboardAdmin } from "@/components/admin/AdminDashboardAdmin";
import { WorkerDashboardWelcome } from "@/components/admin/WorkerDashboardWelcome";

const AdminDashboard = () => {
  const { user, isAdmin, isWorker } = useAdminAuth();

  if (isAdmin && user) {
    return <AdminDashboardAdmin session={user} />;
  }

  if (isWorker && user) {
    return <WorkerDashboardWelcome />;
  }

  return null;
};

export default AdminDashboard;

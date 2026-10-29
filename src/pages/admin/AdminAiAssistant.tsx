import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canUseAiAssistant } from "@/lib/ai/aiAccess";
import { AiAssistant } from "@/components/ai/AiAssistant";

/**
 * /admin/ai — Asistente IA de Inorme.
 * La comprobación aquí solo evita mostrar la pantalla; el servidor vuelve a validar.
 */
const AdminAiAssistant = () => {
  const { role, user } = useAdminAuth();
  if (!user || !canUseAiAssistant(role, user.enabledModules)) {
    return <Navigate to="/admin" replace />;
  }
  return <AiAssistant />;
};

export default AdminAiAssistant;

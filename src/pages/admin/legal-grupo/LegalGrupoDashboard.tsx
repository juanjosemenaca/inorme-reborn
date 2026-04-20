import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLegalClients, useLegalInvoices, useLegalMatters } from "@/hooks/useLegalGrupo";
import { Loader2 } from "lucide-react";

const LegalGrupoDashboard = () => {
  const { t } = useLanguage();
  const { data: clients = [], isLoading: lc } = useLegalClients();
  const { data: matters = [], isLoading: lm } = useLegalMatters();
  const { data: invoices = [], isLoading: li } = useLegalInvoices();

  const loading = lc || lm || li;
  const openMatters = matters.filter((m) => m.status !== "CLOSED").length;

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.legal.dash_clients")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{clients.filter((c) => c.active).length}</p>
              <Link to="/admin/grupo-legal/clientes" className="text-xs text-primary hover:underline mt-2 inline-block">
                {t("admin.legal.dash_manage")}
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.legal.dash_matters_open")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{openMatters}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.legal.dash_matters_total").replace("{{n}}", String(matters.length))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.legal.dash_invoices_draft")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{invoices.filter((i) => i.status === "DRAFT").length}</p>
              <Link to="/admin/grupo-legal/facturas" className="text-xs text-primary hover:underline mt-2 inline-block">
                {t("admin.legal.nav_invoices")}
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.legal.dash_modules_hint")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("admin.legal.dash_modules_body")}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LegalGrupoDashboard;

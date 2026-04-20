import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLegalClients, useLegalInvoices, useLegalMatters } from "@/hooks/useLegalGrupo";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const LegalGrupoInvoicesPage = () => {
  const { t } = useLanguage();
  const { data: invoices = [], isLoading } = useLegalInvoices();
  const { data: clients = [] } = useLegalClients();
  const { data: matters = [] } = useLegalMatters();

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c.displayName])), [clients]);
  const matterById = useMemo(() => new Map(matters.map((m) => [m.id, m.title])), [matters]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.legal.invoices_title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("admin.legal.invoices_hint")}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.legal.field_invoice_ref")}</TableHead>
                <TableHead>{t("admin.legal.field_legal_client")}</TableHead>
                <TableHead>{t("admin.legal.field_matter_title")}</TableHead>
                <TableHead>{t("admin.legal.field_status")}</TableHead>
                <TableHead className="text-right">{t("admin.legal.field_total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.invoiceNumber || inv.id.slice(0, 8)}</TableCell>
                  <TableCell>{clientById.get(inv.legalClientId) ?? "—"}</TableCell>
                  <TableCell>{inv.matterId ? matterById.get(inv.matterId) ?? "—" : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "PAID" ? "default" : "secondary"}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{inv.grandTotal.toFixed(2)} €</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default LegalGrupoInvoicesPage;

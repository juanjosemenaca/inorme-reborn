import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLegalClient } from "@/api/legalGrupoApi";
import { queryKeys } from "@/lib/queryKeys";
import { useLegalClients } from "@/hooks/useLegalGrupo";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LegalClientType } from "@/types/legalGrupo";
import { Loader2, Plus } from "lucide-react";

const LegalGrupoClientsPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: clients = [], isLoading } = useLegalClients();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [fiscalAddress, setFiscalAddress] = useState("");
  const [clientType, setClientType] = useState<LegalClientType>("COMPANY");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      createLegalClient({
        displayName,
        taxId,
        fiscalAddress,
        clientType,
        email,
        phone,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.legalClients });
      toast({ title: t("admin.legal.toast_client_created") });
      setOpen(false);
      setDisplayName("");
      setTaxId("");
      setFiscalAddress("");
      setEmail("");
      setPhone("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{t("admin.legal.clients_title")}</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              {t("admin.legal.clients_new")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.legal.clients_new")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <Label>{t("admin.legal.field_display_name")}</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.legal.field_tax_id")}</Label>
                <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.legal.field_fiscal_address")}</Label>
                <Input value={fiscalAddress} onChange={(e) => setFiscalAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.legal.field_client_type")}</Label>
                <Select value={clientType} onValueChange={(v) => setClientType(v as LegalClientType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPANY">{t("admin.legal.client_type_company")}</SelectItem>
                    <SelectItem value="INDIVIDUAL">{t("admin.legal.client_type_individual")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.legal.field_email")}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.legal.field_phone")}</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!displayName.trim() || !taxId.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                <TableHead>{t("admin.legal.field_display_name")}</TableHead>
                <TableHead>{t("admin.legal.field_tax_id")}</TableHead>
                <TableHead>{t("admin.legal.field_client_type")}</TableHead>
                <TableHead>{t("common.email")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.displayName}</TableCell>
                  <TableCell>{c.taxId}</TableCell>
                  <TableCell>
                    {c.clientType === "COMPANY"
                      ? t("admin.legal.client_type_company")
                      : t("admin.legal.client_type_individual")}
                  </TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default LegalGrupoClientsPage;

import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLegalMatter } from "@/api/legalGrupoApi";
import { queryKeys } from "@/lib/queryKeys";
import { useLegalClients, useLegalMatters } from "@/hooks/useLegalGrupo";
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
import type { LegalMatterType } from "@/types/legalGrupo";
import { Loader2, Plus } from "lucide-react";

const MATTER_TYPES: LegalMatterType[] = [
  "MERCANTIL",
  "FISCAL",
  "LITIGIO",
  "LABORAL",
  "CIVIL",
  "ADMINISTRATIVO",
  "OTHER",
];

const LegalGrupoMattersPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: matters = [], isLoading } = useLegalMatters();
  const { data: clients = [] } = useLegalClients();
  const [open, setOpen] = useState(false);
  const [legalClientId, setLegalClientId] = useState("");
  const [title, setTitle] = useState("");
  const [matterCode, setMatterCode] = useState("");
  const [matterType, setMatterType] = useState<LegalMatterType>("MERCANTIL");

  const createMut = useMutation({
    mutationFn: () =>
      createLegalMatter({
        legalClientId,
        title,
        matterCode: matterCode.trim() || null,
        matterType,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.legalMatters });
      toast({ title: t("admin.legal.toast_matter_created") });
      setOpen(false);
      setLegalClientId("");
      setTitle("");
      setMatterCode("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{t("admin.legal.matters_title")}</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" disabled={clients.length === 0}>
              <Plus className="h-4 w-4" />
              {t("admin.legal.matters_new")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.legal.matters_new")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <Label>{t("admin.legal.field_legal_client")}</Label>
                <Select value={legalClientId} onValueChange={setLegalClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.legal.select_client")} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients
                      .filter((c) => c.active)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.displayName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.legal.field_matter_code")}</Label>
                <Input value={matterCode} onChange={(e) => setMatterCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.legal.field_matter_type")}</Label>
                <Select value={matterType} onValueChange={(v) => setMatterType(v as LegalMatterType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATTER_TYPES.map((mt) => (
                      <SelectItem key={mt} value={mt}>
                        {t(`admin.legal.matter_type_${mt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.legal.field_matter_title")}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!legalClientId || !title.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {clients.length === 0 && (
          <p className="text-sm text-muted-foreground mb-4">{t("admin.legal.matters_need_client")}</p>
        )}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.legal.field_matter_code")}</TableHead>
                <TableHead>{t("admin.legal.field_matter_title")}</TableHead>
                <TableHead>{t("admin.legal.field_matter_type")}</TableHead>
                <TableHead>{t("admin.legal.field_status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matters.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.matterCode || "—"}</TableCell>
                  <TableCell>
                    <Link to={`/admin/grupo-legal/expedientes/${m.id}`} className="font-medium text-primary hover:underline">
                      {m.title}
                    </Link>
                  </TableCell>
                  <TableCell>{t(`admin.legal.matter_type_${m.matterType}`)}</TableCell>
                  <TableCell>{t(`admin.legal.status_${m.status}`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default LegalGrupoMattersPage;

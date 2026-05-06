import { useState } from "react";
import { CloudUpload, FileSpreadsheet, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

function bulkInvoiceGenerateUrl(): string {
  const raw = import.meta.env.VITE_BULK_INVOICE_API_URL?.trim();
  const base = raw?.replace(/\/$/, "") ?? "";
  return base ? `${base}/api/bulk-invoices/generate` : "/api/bulk-invoices/generate";
}

export default function AdminBulkInvoices() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const supabaseOk = isSupabaseConfigured();

  async function onGenerate() {
    if (!supabase) {
      toast({ title: t("admin.bulk_invoices.web_need_supabase"), variant: "destructive" });
      return;
    }
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast({ title: t("admin.bulk_invoices.web_err_session"), variant: "destructive" });
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      if (logoFile) {
        fd.append("logo", logoFile);
      }
      const res = await fetch(bulkInvoiceGenerateUrl(), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const msg =
          typeof errBody?.error === "string" && errBody.error.length > 0
            ? errBody.error
            : `${res.status} ${res.statusText}`;
        toast({ title: msg, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "facturas.zip";
      a.click();
      URL.revokeObjectURL(url);
      const gen = res.headers.get("X-Bulk-Invoice-Generated");
      const skip = res.headers.get("X-Bulk-Invoice-Skipped");
      toast({
        title: t("admin.bulk_invoices.web_done"),
        description: `${t("admin.bulk_invoices.web_generated")}: ${gen ?? "—"}, ${t("admin.bulk_invoices.web_skipped")}: ${skip ?? "—"}`,
      });
    } catch {
      toast({ title: t("admin.bulk_invoices.web_err_network"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="h-7 w-7 text-primary shrink-0" aria-hidden />
          {t("admin.bulk_invoices.title")}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CloudUpload className="h-4 w-4" aria-hidden />
            {t("admin.bulk_invoices.web_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!supabaseOk ? (
            <Alert variant="destructive">
              <AlertTitle>{t("admin.bulk_invoices.web_need_supabase")}</AlertTitle>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="bulk-invoice-file">{t("admin.bulk_invoices.web_pick")}</Label>
            <Input
              id="bulk-invoice-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={!supabaseOk || busy}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-invoice-logo">{t("admin.bulk_invoices.web_pick_logo")}</Label>
            <Input
              id="bulk-invoice-logo"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={!supabaseOk || busy}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setLogoFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground">{t("admin.bulk_invoices.web_pick_logo_hint")}</p>
          </div>
          <Button
            type="button"
            disabled={!supabaseOk || !file || busy}
            onClick={() => void onGenerate()}
            className="w-full sm:w-auto"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                {t("admin.bulk_invoices.web_busy")}
              </>
            ) : (
              t("admin.bulk_invoices.web_btn")
            )}
          </Button>
          {busy ? (
            <Alert>
              <AlertDescription>{t("admin.bulk_invoices.web_busy")}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

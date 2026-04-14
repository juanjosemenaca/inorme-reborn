import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeEuro, Ban, CheckCircle2, FileText, Loader2, Plus, Receipt, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { queryKeys } from "@/lib/queryKeys";
import { useBillingInvoices, useBillingIssuerProfile, useBillingSeries } from "@/hooks/useBilling";
import {
  cancelBillingInvoice,
  createBillingSeries,
  createBillingInvoiceDraft,
  createRectificativeDraftFromInvoice,
  deleteBillingInvoiceForTests,
  emitBillingInvoice,
  registerBillingReceipt,
  replaceBillingInvoiceLines,
  setBillingSeriesActive,
  upsertBillingIssuerProfile,
  updateBillingInvoiceDraftHeader,
} from "@/api/billingApi";
import { openBillingInvoicePdfDownload } from "@/lib/billingInvoicePdf";
import type { BillingInvoiceLineInput, BillingInvoiceRecord } from "@/types/billing";

function emptyLine(): BillingInvoiceLineInput {
  return { lineType: "BILLABLE", description: "", quantity: 1, unitPrice: 0, vatRate: 21, irpfRate: 0 };
}

function emptyConceptLine(): BillingInvoiceLineInput {
  return { lineType: "CONCEPT", description: "", quantity: 0, unitPrice: 0, vatRate: 21, irpfRate: 0 };
}

function emptyBlockTitleLine(): BillingInvoiceLineInput {
  return { lineType: "BLOCK_TITLE", description: "", quantity: 0, unitPrice: 0, vatRate: 21, irpfRate: 0 };
}

function emptyBlockSubtitleLine(): BillingInvoiceLineInput {
  return { lineType: "BLOCK_SUBTITLE", description: "", quantity: 0, unitPrice: 0, vatRate: 21, irpfRate: 0 };
}

function variantByStatus(status: BillingInvoiceRecord["status"]): "outline" | "default" | "destructive" | "secondary" {
  if (status === "PAID") return "default";
  if (status === "CANCELLED") return "destructive";
  if (status === "ISSUED") return "secondary";
  return "outline";
}

const AdminBilling = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const { data: clients = [] } = useClients();
  const { data: issuerProfile } = useBillingIssuerProfile(true);
  const { data: series = [] } = useBillingSeries(true);
  const { data: invoices = [], isLoading } = useBillingInvoices(true);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [newSeriesId, setNewSeriesId] = useState("");
  const [newSeriesCode, setNewSeriesCode] = useState("");
  const [newSeriesLabel, setNewSeriesLabel] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [billingTab, setBillingTab] = useState<"issuers" | "series" | "drafts" | "issued">("drafts");
  const [issuedSearch, setIssuedSearch] = useState("");
  const [issuedClientIdFilter, setIssuedClientIdFilter] = useState("all");
  const [issuedFromDate, setIssuedFromDate] = useState("");
  const [issuedToDate, setIssuedToDate] = useState("");
  const [issuerLegalName, setIssuerLegalName] = useState("");
  const [issuerTaxId, setIssuerTaxId] = useState("");
  const [issuerFiscalAddress, setIssuerFiscalAddress] = useState("");
  const [issuerBankAccountIban, setIssuerBankAccountIban] = useState("");
  const [issuerBankAccountSwift, setIssuerBankAccountSwift] = useState("");
  const [issuerBankName, setIssuerBankName] = useState("");
  const [issuerEmail, setIssuerEmail] = useState("");
  const [issuerPhone, setIssuerPhone] = useState("");

  const selectedInvoice = useMemo(
    () => (selectedInvoiceId ? invoices.find((x) => x.id === selectedInvoiceId) ?? null : null),
    [invoices, selectedInvoiceId]
  );
  const editable = selectedInvoice?.status === "DRAFT";

  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftLines, setDraftLines] = useState<BillingInvoiceLineInput[]>([]);

  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptMethod, setReceiptMethod] = useState("BANK_TRANSFER");
  const [receiptReference, setReceiptReference] = useState("");

  const activeSeries = useMemo(() => series.filter((s) => s.active), [series]);
  const draftInvoices = useMemo(() => invoices.filter((i) => i.status === "DRAFT"), [invoices]);
  const issuedInvoices = useMemo(() => invoices.filter((i) => i.status !== "DRAFT"), [invoices]);
  const issuedInvoicesFiltered = useMemo(() => {
    const q = issuedSearch.trim().toLowerCase();
    return issuedInvoices.filter((inv) => {
      if (issuedClientIdFilter !== "all" && inv.clientId !== issuedClientIdFilter) return false;
      if (issuedFromDate && (inv.issueDate ?? "") < issuedFromDate) return false;
      if (issuedToDate && (inv.issueDate ?? "") > issuedToDate) return false;
      if (!q) return true;
      const number =
        inv.invoiceNumber && inv.fiscalYear
          ? `${inv.seriesCode}-${inv.fiscalYear}/${String(inv.invoiceNumber).padStart(4, "0")}`
          : `${inv.seriesCode}-${inv.status}`;
      const hay = [number, inv.recipientName, inv.recipientTaxId, inv.notes].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [issuedInvoices, issuedSearch, issuedClientIdFilter, issuedFromDate, issuedToDate]);

  useEffect(() => {
    if (!newSeriesId && activeSeries.length > 0) setNewSeriesId(activeSeries[0].id);
    if (!newClientId && clients.length > 0) setNewClientId(clients[0].id);
  }, [activeSeries, clients, newSeriesId, newClientId]);

  useEffect(() => {
    setIssuerLegalName(issuerProfile?.legalName ?? "");
    setIssuerTaxId(issuerProfile?.taxId ?? "");
    setIssuerFiscalAddress(issuerProfile?.fiscalAddress ?? "");
    setIssuerBankAccountIban(issuerProfile?.bankAccountIban ?? "");
    setIssuerBankAccountSwift(issuerProfile?.bankAccountSwift ?? "");
    setIssuerBankName(issuerProfile?.bankName ?? "");
    setIssuerEmail(issuerProfile?.email ?? "");
    setIssuerPhone(issuerProfile?.phone ?? "");
  }, [issuerProfile]);

  useEffect(() => {
    const scope =
      billingTab === "drafts" ? draftInvoices : billingTab === "issued" ? issuedInvoicesFiltered : [];
    if (scope.length === 0) {
      setSelectedInvoiceId(null);
      return;
    }
    if (!selectedInvoiceId || !scope.some((x) => x.id === selectedInvoiceId)) {
      setSelectedInvoiceId(scope[0].id);
    }
  }, [billingTab, selectedInvoiceId, draftInvoices, issuedInvoicesFiltered]);

  useEffect(() => {
    if (!selectedInvoice) {
      setDraftDueDate("");
      setDraftNotes("");
      setDraftLines([]);
      return;
    }
    setDraftDueDate(selectedInvoice.dueDate ?? "");
    setDraftNotes(selectedInvoice.notes ?? "");
    setDraftLines(
      selectedInvoice.lines.map((line) => ({
        lineType: line.lineType ?? "BILLABLE",
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate as 21 | 10 | 4,
        irpfRate: line.irpfRate,
      }))
    );
  }, [selectedInvoice]);

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.billingIssuerProfile });
    await qc.invalidateQueries({ queryKey: queryKeys.billingSeries });
    await qc.invalidateQueries({ queryKey: queryKeys.billingInvoices });
  };

  const saveIssuerMutation = useMutation({
    mutationFn: () =>
      upsertBillingIssuerProfile({
        legalName: issuerLegalName,
        taxId: issuerTaxId,
        fiscalAddress: issuerFiscalAddress,
        bankAccountIban: issuerBankAccountIban || null,
        bankAccountSwift: issuerBankAccountSwift || null,
        bankName: issuerBankName || null,
        email: issuerEmail || null,
        phone: issuerPhone || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.billingIssuerProfile });
      toast({ title: t("admin.billing.toast_issuer_saved") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const createSeriesMutation = useMutation({
    mutationFn: () => createBillingSeries({ code: newSeriesCode, label: newSeriesLabel }),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: queryKeys.billingSeries });
      setNewSeriesCode("");
      setNewSeriesLabel("");
      setNewSeriesId(created.id);
      toast({ title: t("admin.billing.toast_series_created") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const toggleSeriesMutation = useMutation({
    mutationFn: ({ seriesId, active }: { seriesId: string; active: boolean }) =>
      setBillingSeriesActive(seriesId, active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.billingSeries });
      toast({ title: t("admin.billing.toast_series_updated") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const createDraftMutation = useMutation({
    mutationFn: () =>
      createBillingInvoiceDraft({
        seriesId: newSeriesId,
        clientId: newClientId,
        dueDate: newDueDate || null,
        notes: newNotes,
      }),
    onSuccess: async (created) => {
      await invalidateAll();
      setSelectedInvoiceId(created.id);
      setNewNotes("");
      toast({ title: t("admin.billing.toast_draft_created") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) throw new Error("Factura no encontrada.");
      await updateBillingInvoiceDraftHeader(selectedInvoice.id, { dueDate: draftDueDate || null, notes: draftNotes });
      await replaceBillingInvoiceLines(selectedInvoice.id, draftLines);
    },
    onSuccess: async () => {
      await invalidateAll();
      toast({ title: t("admin.billing.toast_draft_saved") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const emitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) throw new Error("Factura no encontrada.");
      await updateBillingInvoiceDraftHeader(selectedInvoice.id, { dueDate: draftDueDate || null, notes: draftNotes });
      await replaceBillingInvoiceLines(selectedInvoice.id, draftLines);
      await emitBillingInvoice(selectedInvoice.id);
    },
    onSuccess: async () => {
      await invalidateAll();
      toast({ title: t("admin.billing.toast_issued") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) throw new Error("Factura no encontrada.");
      const reason = window.prompt(t("admin.billing.cancel_prompt"))?.trim() ?? "";
      if (!reason) return;
      await cancelBillingInvoice(selectedInvoice.id, reason);
    },
    onSuccess: async () => {
      await invalidateAll();
      toast({ title: t("admin.billing.toast_cancelled") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const rectificativeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) throw new Error("Factura no encontrada.");
      if (!newSeriesId) throw new Error("Selecciona serie.");
      return createRectificativeDraftFromInvoice(selectedInvoice.id, newSeriesId);
    },
    onSuccess: async (draft) => {
      await invalidateAll();
      setSelectedInvoiceId(draft.id);
      toast({ title: t("admin.billing.toast_rectificative_created") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) throw new Error("Factura no encontrada.");
      const ok = window.confirm(t("admin.billing.delete_confirm_test_mode"));
      if (!ok) return;
      await deleteBillingInvoiceForTests(selectedInvoice.id);
    },
    onSuccess: async () => {
      const prevId = selectedInvoiceId;
      await invalidateAll();
      if (prevId === selectedInvoiceId) setSelectedInvoiceId(null);
      toast({ title: t("admin.billing.toast_deleted_test_mode") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const receiptMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) throw new Error("Factura no encontrada.");
      await registerBillingReceipt({
        invoiceId: selectedInvoice.id,
        receiptDate,
        amount: Number(receiptAmount.replace(",", ".")),
        method: receiptMethod,
        reference: receiptReference,
      });
    },
    onSuccess: async () => {
      await invalidateAll();
      setReceiptAmount("");
      setReceiptReference("");
      toast({ title: t("admin.billing.toast_receipt_saved") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s] as const)), [series]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BadgeEuro className="h-6 w-6 text-primary" />
          {t("admin.billing.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("admin.billing.subtitle")}</p>
      </div>

      <Tabs value={billingTab} onValueChange={(v) => setBillingTab(v as "issuers" | "series" | "drafts" | "issued")}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="issuers">{t("admin.billing.tab_issuers")}</TabsTrigger>
          <TabsTrigger value="series">{t("admin.billing.tab_series")}</TabsTrigger>
          <TabsTrigger value="drafts">{t("admin.billing.tab_drafts")}</TabsTrigger>
          <TabsTrigger value="issued">{t("admin.billing.tab_issued")}</TabsTrigger>
        </TabsList>

        <TabsContent value="issuers" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.billing.issuer_title")}</CardTitle>
              <CardDescription>{t("admin.billing.issuer_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("admin.billing.issuer_legal_name")}</Label>
                <Input value={issuerLegalName} onChange={(e) => setIssuerLegalName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.issuer_tax_id")}</Label>
                <Input value={issuerTaxId} onChange={(e) => setIssuerTaxId(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("admin.billing.issuer_fiscal_address")}</Label>
                <Input value={issuerFiscalAddress} onChange={(e) => setIssuerFiscalAddress(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.issuer_bank_name")}</Label>
                <Input value={issuerBankName} onChange={(e) => setIssuerBankName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.issuer_bank_iban")}</Label>
                <Input value={issuerBankAccountIban} onChange={(e) => setIssuerBankAccountIban(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.issuer_bank_swift")}</Label>
                <Input value={issuerBankAccountSwift} onChange={(e) => setIssuerBankAccountSwift(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.common.email")}</Label>
                <Input value={issuerEmail} onChange={(e) => setIssuerEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.common.phone")}</Label>
                <Input value={issuerPhone} onChange={(e) => setIssuerPhone(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => saveIssuerMutation.mutate()} disabled={saveIssuerMutation.isPending}>
                  {saveIssuerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {t("admin.billing.issuer_save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="series" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.billing.series_title")}</CardTitle>
              <CardDescription>{t("admin.billing.series_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto]">
                <Input
                  placeholder={t("admin.billing.series_code_ph")}
                  value={newSeriesCode}
                  onChange={(e) => setNewSeriesCode(e.target.value.toUpperCase())}
                />
                <Input
                  placeholder={t("admin.billing.series_label_ph")}
                  value={newSeriesLabel}
                  onChange={(e) => setNewSeriesLabel(e.target.value)}
                />
                <Button type="button" onClick={() => createSeriesMutation.mutate()} disabled={createSeriesMutation.isPending}>
                  {createSeriesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {t("admin.billing.series_create")}
                </Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.billing.col_series")}</TableHead>
                      <TableHead>{t("admin.common.name")}</TableHead>
                      <TableHead>{t("admin.common.status")}</TableHead>
                      <TableHead className="text-right">{t("admin.common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {series.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.code}</TableCell>
                        <TableCell>{s.label}</TableCell>
                        <TableCell>
                          <Badge variant={s.active ? "default" : "outline"}>
                            {s.active ? t("admin.billing.series_status_active") : t("admin.billing.series_status_inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={toggleSeriesMutation.isPending}
                            onClick={() => toggleSeriesMutation.mutate({ seriesId: s.id, active: !s.active })}
                          >
                            {s.active ? t("admin.billing.series_disable") : t("admin.billing.series_enable")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.billing.new_draft_title")}</CardTitle>
              <CardDescription>{t("admin.billing.new_draft_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("admin.billing.col_series")}</Label>
                <Select value={newSeriesId} onValueChange={setNewSeriesId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSeries.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code} · {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.col_client")}</Label>
                <Select value={newClientId} onValueChange={setNewClientId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {(c.companyName || c.tradeName || c.cif).trim()} · {c.cif}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.col_due_date")}</Label>
                <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("admin.billing.col_notes")}</Label>
                <Textarea rows={2} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  onClick={() => createDraftMutation.mutate()}
                  disabled={createDraftMutation.isPending || !newSeriesId || !newClientId}
                >
                  {createDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {t("admin.billing.action_create_draft")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.billing.drafts_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-8 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("admin.common.loading")}
                </div>
              ) : draftInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{t("admin.billing.empty")}</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.billing.col_invoice")}</TableHead>
                        <TableHead>{t("admin.billing.col_client")}</TableHead>
                        <TableHead>{t("admin.billing.col_due_date")}</TableHead>
                        <TableHead className="text-right">{t("admin.common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{`${inv.seriesCode}-BORRADOR`}</TableCell>
                          <TableCell>{inv.recipientName || "—"}</TableCell>
                          <TableCell>{inv.dueDate ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedInvoiceId(inv.id)}>
                              {t("admin.billing.action_open")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issued" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.billing.issued_filters_title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("admin.billing.search_ph")}</Label>
                <Input
                  placeholder={t("admin.billing.search_ph")}
                  value={issuedSearch}
                  onChange={(e) => setIssuedSearch(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.col_client")}</Label>
                <Select value={issuedClientIdFilter} onValueChange={setIssuedClientIdFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.common.filter_all")}</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {(c.companyName || c.tradeName || c.cif).trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.filter_from")}</Label>
                <Input type="date" value={issuedFromDate} onChange={(e) => setIssuedFromDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.filter_to")}</Label>
                <Input type="date" value={issuedToDate} onChange={(e) => setIssuedToDate(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.billing.issued_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-8 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("admin.common.loading")}
                </div>
              ) : issuedInvoicesFiltered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{t("admin.billing.empty")}</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.billing.col_invoice")}</TableHead>
                        <TableHead>{t("admin.billing.col_status")}</TableHead>
                        <TableHead>{t("admin.billing.col_client")}</TableHead>
                        <TableHead>{t("admin.billing.col_issue_date")}</TableHead>
                        <TableHead className="text-right">{t("admin.billing.col_total")}</TableHead>
                        <TableHead className="text-right">{t("admin.common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issuedInvoicesFiltered.map((inv) => {
                        const number = `${inv.seriesCode}-${inv.fiscalYear}/${String(inv.invoiceNumber).padStart(4, "0")}`;
                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">{number}</TableCell>
                            <TableCell>
                              <Badge variant={variantByStatus(inv.status)}>{inv.status}</Badge>
                            </TableCell>
                            <TableCell>{inv.recipientName || "—"}</TableCell>
                            <TableCell>{inv.issueDate ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {inv.grandTotal.toLocaleString(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </TableCell>
                            <TableCell className="text-right">
                              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedInvoiceId(inv.id)}>
                                {t("admin.billing.action_open")}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedInvoice && (billingTab === "drafts" || billingTab === "issued") ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedInvoice.invoiceNumber && selectedInvoice.fiscalYear
                ? `${selectedInvoice.seriesCode}-${selectedInvoice.fiscalYear}/${String(selectedInvoice.invoiceNumber).padStart(4, "0")}`
                : `${seriesById.get(selectedInvoice.seriesId)?.code ?? "?"} · ${t("admin.billing.draft_label")}`}
            </CardTitle>
            <CardDescription>
              {selectedInvoice.recipientName} · {selectedInvoice.recipientTaxId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("admin.billing.col_due_date")}</Label>
                <Input type="date" value={draftDueDate} onChange={(e) => setDraftDueDate(e.target.value)} disabled={!editable} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.col_payment_status")}</Label>
                <Input value={selectedInvoice.paymentStatus} disabled />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("admin.billing.col_notes")}</Label>
                <Textarea rows={2} value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} disabled={!editable} />
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">{t("admin.billing.col_line_type")}</TableHead>
                    <TableHead>{t("admin.billing.col_concept")}</TableHead>
                    <TableHead className="w-[90px]">{t("admin.billing.col_qty")}</TableHead>
                    <TableHead className="w-[120px]">{t("admin.billing.col_unit_price")}</TableHead>
                    <TableHead className="w-[90px]">IVA %</TableHead>
                    <TableHead className="w-[90px]">IRPF %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftLines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select
                          value={line.lineType}
                          disabled={!editable}
                          onValueChange={(v) =>
                            setDraftLines((prev) =>
                              prev.map((x, i) =>
                                i !== idx
                                  ? x
                                  : v === "BILLABLE"
                                    ? {
                                        ...x,
                                        lineType: "BILLABLE",
                                        quantity: x.quantity > 0 ? x.quantity : 1,
                                        unitPrice: x.unitPrice,
                                        vatRate: x.vatRate as 21 | 10 | 4,
                                      }
                                    : { ...x, lineType: v as BillingInvoiceLineInput["lineType"], quantity: 0, unitPrice: 0, irpfRate: 0 }
                              )
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BILLABLE">{t("admin.billing.line_type_billable")}</SelectItem>
                            <SelectItem value="BLOCK_TITLE">{t("admin.billing.line_type_block_title")}</SelectItem>
                            <SelectItem value="BLOCK_SUBTITLE">{t("admin.billing.line_type_block_subtitle")}</SelectItem>
                            <SelectItem value="CONCEPT">{t("admin.billing.line_type_concept")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.description}
                          disabled={!editable}
                          onChange={(e) =>
                            setDraftLines((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.quantity}
                          disabled={!editable || line.lineType !== "BILLABLE"}
                          onChange={(e) =>
                            setDraftLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.unitPrice}
                          disabled={!editable || line.lineType !== "BILLABLE"}
                          onChange={(e) =>
                            setDraftLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unitPrice: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={String(line.vatRate)}
                          onValueChange={(v) =>
                            setDraftLines((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, vatRate: Number(v) as 21 | 10 | 4 } : x))
                            )
                          }
                          disabled={!editable || line.lineType !== "BILLABLE"}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="21">21</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.irpfRate}
                          disabled={!editable || line.lineType !== "BILLABLE"}
                          onChange={(e) =>
                            setDraftLines((prev) => prev.map((x, i) => (i === idx ? { ...x, irpfRate: Number(e.target.value || 0) } : x)))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap gap-2">
              {editable ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setDraftLines((prev) => [...prev, emptyLine()])}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("admin.billing.action_add_line")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDraftLines((prev) => [...prev, emptyConceptLine()])}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("admin.billing.action_add_concept_line")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDraftLines((prev) => [...prev, emptyBlockTitleLine()])}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("admin.billing.action_add_block_title_line")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDraftLines((prev) => [...prev, emptyBlockSubtitleLine()])}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("admin.billing.action_add_block_subtitle_line")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
                    {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {t("admin.billing.action_save_draft")}
                  </Button>
                  <Button type="button" onClick={() => emitMutation.mutate()} disabled={emitMutation.isPending}>
                    {emitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {t("admin.billing.action_emit")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void openBillingInvoicePdfDownload(selectedInvoice).catch((e) =>
                        toast({
                          title: t("admin.common.error"),
                          description: e instanceof Error ? e.message : "",
                          variant: "destructive",
                        })
                      );
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {t("admin.billing.action_pdf")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => rectificativeMutation.mutate()} disabled={rectificativeMutation.isPending}>
                    {rectificativeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Receipt className="h-4 w-4 mr-2" />}
                    {t("admin.billing.action_rectificative")}
                  </Button>
                  {selectedInvoice.status !== "CANCELLED" ? (
                    <Button type="button" variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                      {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                      {t("admin.billing.action_cancel")}
                    </Button>
                  ) : null}
                  <Button type="button" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                    {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                    {t("admin.billing.action_delete_test_mode")}
                  </Button>
                </>
              )}
            </div>

            {selectedInvoice.status !== "DRAFT" && selectedInvoice.status !== "CANCELLED" ? (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">{t("admin.billing.receipts_title")}</p>
                <div className="grid gap-2 sm:grid-cols-4">
                  <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
                  <Input
                    placeholder={t("admin.billing.receipt_amount_ph")}
                    value={receiptAmount}
                    onChange={(e) => setReceiptAmount(e.target.value)}
                  />
                  <Input value={receiptMethod} onChange={(e) => setReceiptMethod(e.target.value)} />
                  <Input
                    placeholder={t("admin.billing.receipt_reference_ph")}
                    value={receiptReference}
                    onChange={(e) => setReceiptReference(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={() => receiptMutation.mutate()} disabled={receiptMutation.isPending || !receiptAmount}>
                  {receiptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Receipt className="h-4 w-4 mr-2" />}
                  {t("admin.billing.action_add_receipt")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default AdminBilling;

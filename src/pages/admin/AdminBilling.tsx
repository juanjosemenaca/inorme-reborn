import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeEuro,
  Ban,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileSearch,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { queryKeys } from "@/lib/queryKeys";
import { useBillingInvoices, useBillingIssuers, useBillingSeries } from "@/hooks/useBilling";
import {
  cancelBillingInvoice,
  createBillingIssuer,
  createBillingSeries,
  createBillingInvoiceDraft,
  createRectificativeDraftFromInvoice,
  deleteBillingInvoiceDraft,
  deleteBillingInvoiceForTests,
  duplicateBillingInvoiceDraft,
  emitBillingInvoice,
  fetchBillingIssuerLogoDataUrl,
  registerBillingReceipt,
  removeBillingIssuerLogo,
  replaceBillingInvoiceLines,
  setBillingIssuerActive,
  setBillingSeriesActive,
  updateBillingIssuer,
  updateBillingInvoiceDraftHeader,
  uploadBillingIssuerLogo,
} from "@/api/billingApi";
import {
  BillingPdfMissingTraceabilityError,
  computeDraftBillableTotals,
  openBillingInvoicePdfDownload,
  openBillingInvoiceProformaDownload,
} from "@/lib/billingInvoicePdf";
import { isInormeInformaticaOrganizacionIssuer } from "@/lib/billingPrivacyFooter";
import {
  draftGroupYearMonth,
  formatInvoiceMonthOnly,
  groupInvoicesByIssuerAndMonth,
  issuedGroupYearMonth,
} from "@/lib/billingInvoiceGroups";
import { parseInvoiceAddresseeOptions } from "@/lib/invoiceAddresseeOptions";
import type { ClientRecord } from "@/types/clients";
import type {
  BillingInvoiceLineInput,
  BillingInvoiceRecord,
  BillingIssuerRecord,
  BillingSeriesRecord,
} from "@/types/billing";

type BillingTab = "issuers" | "series" | "drafts" | "issued";

type DraftLeaveIntent =
  | { type: "close" }
  | { type: "select"; id: string }
  | { type: "tab"; next: BillingTab };

function normInvoiceAddressee(a: string | null | undefined): string | null {
  const t = (a ?? "").trim();
  return t === "" ? null : t;
}

/** `isoYmd` = YYYY-MM-DD → misma fecha tras sumar meses naturales (p. ej. vencimiento +2 meses). */
function addCalendarMonthsYmd(isoYmd: string, monthsToAdd: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoYmd)) return "";
  const [ys, ms, ds] = isoYmd.split("-").map(Number);
  const dt = new Date(ys, ms - 1 + monthsToAdd, ds);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const NEW_DRAFT_COPY_LINES_NONE = "__none__";

/** Etiqueta compacta para elegir factura origen (mismo cliente). */
function formatInvoiceCopySourceLabel(inv: BillingInvoiceRecord, localeTag: string, draftLabel: string): string {
  const ref =
    inv.invoiceNumber != null && inv.fiscalYear != null
      ? `${inv.seriesCode}-${inv.fiscalYear}/${String(inv.invoiceNumber).padStart(4, "0")}`
      : inv.status === "DRAFT"
        ? `${inv.seriesCode} · ${draftLabel}`
        : inv.seriesCode;
  const dateRaw = inv.issueDate || inv.issuedAt?.slice(0, 10) || inv.createdAt.slice(0, 10);
  const dateLabel = dateRaw
    ? new Date(`${dateRaw}T12:00:00`).toLocaleDateString(localeTag, { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const money = new Intl.NumberFormat(localeTag, { style: "currency", currency: "EUR" }).format(inv.grandTotal);
  return `${ref} · ${dateLabel} · ${money}`;
}

/** Compara el borrador en pantalla con la última versión guardada en servidor. */
function isDraftDirtyComparedToSaved(
  inv: BillingInvoiceRecord,
  draftIssuerId: string,
  draftSeriesId: string,
  draftDueDate: string,
  draftIssueDate: string,
  draftNotes: string,
  draftRecipientAddresseeLine: string,
  draftLines: BillingInvoiceLineInput[]
): boolean {
  if ((draftDueDate || "") !== (inv.dueDate ?? "")) return true;
  if ((draftIssueDate || "") !== (inv.issueDate ?? "")) return true;
  if ((draftNotes ?? "") !== (inv.notes ?? "")) return true;
  if (normInvoiceAddressee(draftRecipientAddresseeLine) !== normInvoiceAddressee(inv.recipientAddresseeLine)) {
    return true;
  }
  if (draftIssuerId !== inv.issuerId) return true;
  if (draftSeriesId !== inv.seriesId) return true;
  if (draftLines.length !== inv.lines.length) return true;
  for (let i = 0; i < draftLines.length; i++) {
    const a = draftLines[i];
    const b = inv.lines[i];
    const ltA = a.lineType ?? "BILLABLE";
    const ltB = b.lineType ?? "BILLABLE";
    if (ltA !== ltB) return true;
    if ((a.description ?? "") !== (b.description ?? "")) return true;
    if (Number(a.quantity) !== Number(b.quantity)) return true;
    if (Number(a.unitPrice) !== Number(b.unitPrice)) return true;
    if (Number(a.billableHoursPercent ?? 100) !== Number(b.billableHoursPercent ?? 100)) return true;
    if (Number(a.vatRate) !== Number(b.vatRate)) return true;
    if (Number(a.irpfRate) !== Number(b.irpfRate)) return true;
  }
  return false;
}

function emptyLine(): BillingInvoiceLineInput {
  return {
    lineType: "BILLABLE",
    description: "",
    quantity: 1,
    unitPrice: 0,
    billableHoursPercent: 100,
    vatRate: 21,
    irpfRate: 0,
  };
}

function isPartialBillableHoursPct(line: BillingInvoiceLineInput): boolean {
  if (line.lineType !== "BILLABLE") return false;
  const p = line.billableHoursPercent ?? 100;
  return Math.abs(p - 100) > 1e-6;
}

function effectiveBillableQuantity(line: BillingInvoiceLineInput): number {
  const p = line.billableHoursPercent ?? 100;
  return Math.round(line.quantity * (p / 100) * 10000) / 10000;
}

/** Cabecera emisor/fechas como en pantalla (puede no estar guardada aún). */
function mergeProformaHeaderFromForm(
  inv: BillingInvoiceRecord,
  draftIssuerId: string,
  issuerList: BillingIssuerRecord[],
  draftDueDate: string,
  draftIssueDate: string,
  draftNotes: string,
  draftRecipientAddresseeLine: string,
  allSeries: BillingSeriesRecord[],
  draftSeriesIdForHeader: string,
  clientList: Pick<ClientRecord, "id" | "websiteUrl" | "invoiceAddresseeLine">[]
): BillingInvoiceRecord {
  const issuer = issuerList.find((i) => i.id === draftIssuerId);
  const client = clientList.find((c) => c.id === inv.clientId);
  const sid = draftSeriesIdForHeader || inv.seriesId;
  const ser = allSeries.find((s) => s.id === sid);
  const clientWeb = client?.websiteUrl?.trim();
  const plannedIssue = draftIssueDate.trim();
  return {
    ...inv,
    seriesId: sid,
    seriesCode: ser?.code ?? inv.seriesCode,
    dueDate: draftDueDate || null,
    issueDate: plannedIssue ? plannedIssue : inv.issueDate ?? null,
    notes: draftNotes,
    recipientAddresseeLine: normInvoiceAddressee(draftRecipientAddresseeLine),
    issuerLogoStoragePath: issuer?.logoStoragePath ?? inv.issuerLogoStoragePath,
    issuerWebsiteUrl: issuer?.websiteUrl ?? inv.issuerWebsiteUrl,
    issuerPrivacyFooter: issuer
      ? isInormeInformaticaOrganizacionIssuer(issuer.taxId)
        ? null
        : issuer.privacyFooterText?.trim() || null
      : inv.issuerPrivacyFooter,
    recipientWebsiteUrl: clientWeb ? clientWeb : inv.recipientWebsiteUrl,
    ...(issuer
      ? {
          issuerId: issuer.id,
          issuerCode: issuer.code,
          issuerName: issuer.legalName,
          issuerTaxId: issuer.taxId,
          issuerFiscalAddress: issuer.fiscalAddress,
          issuerBankAccountIban: issuer.bankAccountIban,
          issuerBankAccountSwift: issuer.bankAccountSwift,
          issuerBankName: issuer.bankName,
          issuerEmail: issuer.email?.trim() || null,
          issuerPhone: issuer.phone?.trim() || null,
        }
      : {}),
  };
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
  const { data: issuers = [] } = useBillingIssuers(true);
  const { data: series = [] } = useBillingSeries(true);
  const { data: invoices = [], isLoading } = useBillingInvoices(true);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [newSeriesId, setNewSeriesId] = useState("");
  const [newIssuerId, setNewIssuerId] = useState("");
  const [newSeriesIssuerId, setNewSeriesIssuerId] = useState("");
  const [rectificativeSeriesId, setRectificativeSeriesId] = useState("");
  const [newSeriesCode, setNewSeriesCode] = useState("");
  const [newSeriesLabel, setNewSeriesLabel] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newInvoiceDate, setNewInvoiceDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  /** Factura existente (mismo cliente) de la que copiar líneas al crear el borrador; `NEW_DRAFT_COPY_LINES_NONE` = empezar de cero. */
  const [newCopyLinesFromInvoiceId, setNewCopyLinesFromInvoiceId] = useState(NEW_DRAFT_COPY_LINES_NONE);
  const [billingTab, setBillingTab] = useState<BillingTab>("drafts");
  const [issuedSearch, setIssuedSearch] = useState("");
  const [issuedClientIdFilter, setIssuedClientIdFilter] = useState("all");
  const [issuedIssuerIdFilter, setIssuedIssuerIdFilter] = useState("all");
  const [issuedFromDate, setIssuedFromDate] = useState("");
  const [issuedToDate, setIssuedToDate] = useState("");
  const [issuerFormOpen, setIssuerFormOpen] = useState(false);
  const [seriesCreateOpen, setSeriesCreateOpen] = useState(false);
  const [newDraftFormOpen, setNewDraftFormOpen] = useState(false);
  const [editingIssuerId, setEditingIssuerId] = useState<string | null>(null);
  const [issuerCode, setIssuerCode] = useState("");
  const [issuerLegalName, setIssuerLegalName] = useState("");
  const [issuerTaxId, setIssuerTaxId] = useState("");
  const [issuerFiscalAddress, setIssuerFiscalAddress] = useState("");
  const [issuerBankAccountIban, setIssuerBankAccountIban] = useState("");
  const [issuerBankAccountSwift, setIssuerBankAccountSwift] = useState("");
  const [issuerBankName, setIssuerBankName] = useState("");
  const [issuerEmail, setIssuerEmail] = useState("");
  const [issuerPhone, setIssuerPhone] = useState("");
  const [issuerWebsiteUrl, setIssuerWebsiteUrl] = useState("");
  const [issuerPrivacyFooterText, setIssuerPrivacyFooterText] = useState("");
  const [issuerLogoPreviewUrl, setIssuerLogoPreviewUrl] = useState("");

  const selectedInvoice = useMemo(
    () => (selectedInvoiceId ? invoices.find((x) => x.id === selectedInvoiceId) ?? null : null),
    [invoices, selectedInvoiceId]
  );
  const seriesForRectificative = useMemo(() => {
    if (!selectedInvoice || selectedInvoice.status === "DRAFT") return [];
    return series.filter((s) => s.active && s.issuerId === selectedInvoice.issuerId);
  }, [series, selectedInvoice]);
  const editable = selectedInvoice?.status === "DRAFT";

  const [draftDueDate, setDraftDueDate] = useState("");
  /** Fecha de factura forzada (borrador). Vacío = al emitir se usará la fecha del momento. */
  const [draftIssueDate, setDraftIssueDate] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  /** Línea elegida para «Factura dirigida a» en PDF (coincide con snapshot en borrador). */
  const [draftRecipientAddresseeLine, setDraftRecipientAddresseeLine] = useState("");
  const [draftIssuerId, setDraftIssuerId] = useState("");
  const [draftSeriesId, setDraftSeriesId] = useState("");
  const [draftLines, setDraftLines] = useState<BillingInvoiceLineInput[]>([]);
  const afterDraftSaveNavRef = useRef<null | { type: "select"; id: string } | { type: "tab"; next: BillingTab }>(null);
  const [draftLeaveDialogOpen, setDraftLeaveDialogOpen] = useState(false);
  const [pendingDraftLeave, setPendingDraftLeave] = useState<DraftLeaveIntent | null>(null);

  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptMethod, setReceiptMethod] = useState("BANK_TRANSFER");
  const [receiptReference, setReceiptReference] = useState("");

  const seriesForNewDraft = useMemo(
    () => series.filter((s) => s.active && s.issuerId === newIssuerId),
    [series, newIssuerId]
  );
  const issuerLabelById = useMemo(() => new Map(issuers.map((i) => [i.id, `${i.code} · ${i.legalName}`] as const)), [issuers]);
  const seriesSelectableForDraft = useMemo(
    () => series.filter((s) => (s.active && s.issuerId === draftIssuerId) || s.id === draftSeriesId),
    [series, draftIssuerId, draftSeriesId]
  );
  const activeIssuers = useMemo(() => issuers.filter((i) => i.active), [issuers]);
  const issuersSelectableForDraft = useMemo(
    () => issuers.filter((i) => i.active || i.id === draftIssuerId),
    [issuers, draftIssuerId]
  );
  const draftInvoices = useMemo(() => invoices.filter((i) => i.status === "DRAFT"), [invoices]);
  const issuedInvoices = useMemo(() => invoices.filter((i) => i.status !== "DRAFT"), [invoices]);
  /** Facturas del cliente con al menos una línea (emitidas, cobradas o borradores), para reutilizar conceptos/importes. */
  const invoicesForNewDraftLineCopy = useMemo(() => {
    if (!newClientId) return [];
    const list = invoices.filter(
      (inv) => inv.clientId === newClientId && inv.status !== "CANCELLED" && inv.lines.length > 0
    );
    return list.sort((a, b) => {
      const ta = (a.issueDate || a.issuedAt?.slice(0, 10) || a.createdAt).slice(0, 10);
      const tb = (b.issueDate || b.issuedAt?.slice(0, 10) || b.createdAt).slice(0, 10);
      return tb.localeCompare(ta);
    });
  }, [invoices, newClientId]);
  const draftClientForAddressee = useMemo(
    () => (selectedInvoice ? clients.find((c) => c.id === selectedInvoice.clientId) : undefined),
    [clients, selectedInvoice]
  );
  const invoiceAddresseeSelectOptions = useMemo(
    () => parseInvoiceAddresseeOptions(draftClientForAddressee?.invoiceAddresseeLine),
    [draftClientForAddressee?.invoiceAddresseeLine]
  );

  const issuedInvoicesFiltered = useMemo(() => {
    const q = issuedSearch.trim().toLowerCase();
    return issuedInvoices.filter((inv) => {
      if (issuedClientIdFilter !== "all" && inv.clientId !== issuedClientIdFilter) return false;
      if (issuedIssuerIdFilter !== "all" && inv.issuerId !== issuedIssuerIdFilter) return false;
      if (issuedFromDate && (inv.issueDate ?? "") < issuedFromDate) return false;
      if (issuedToDate && (inv.issueDate ?? "") > issuedToDate) return false;
      if (!q) return true;
      const number =
        inv.invoiceNumber && inv.fiscalYear
          ? `${inv.seriesCode}-${inv.fiscalYear}/${String(inv.invoiceNumber).padStart(4, "0")}`
          : `${inv.seriesCode}-${inv.status}`;
      const hay = [number, inv.issuerCode, inv.issuerName, inv.recipientName, inv.recipientTaxId, inv.notes]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [issuedInvoices, issuedSearch, issuedClientIdFilter, issuedIssuerIdFilter, issuedFromDate, issuedToDate]);

  const issuerOrderForGrouping = useMemo(() => issuers.map((i) => ({ id: i.id, code: i.code })), [issuers]);
  const draftGrouped = useMemo(
    () => groupInvoicesByIssuerAndMonth(draftInvoices, draftGroupYearMonth, issuerOrderForGrouping),
    [draftInvoices, issuerOrderForGrouping]
  );
  const issuedGrouped = useMemo(
    () => groupInvoicesByIssuerAndMonth(issuedInvoicesFiltered, issuedGroupYearMonth, issuerOrderForGrouping),
    [issuedInvoicesFiltered, issuerOrderForGrouping]
  );

  const draftBillableTotalsPreview = useMemo(() => computeDraftBillableTotals(draftLines), [draftLines]);

  const isDraftDirty = useMemo(() => {
    if (!selectedInvoice || selectedInvoice.status !== "DRAFT") return false;
    return isDraftDirtyComparedToSaved(
      selectedInvoice,
      draftIssuerId,
      draftSeriesId,
      draftDueDate,
      draftIssueDate,
      draftNotes,
      draftRecipientAddresseeLine,
      draftLines
    );
  }, [
    selectedInvoice,
    draftIssuerId,
    draftSeriesId,
    draftDueDate,
    draftIssueDate,
    draftNotes,
    draftRecipientAddresseeLine,
    draftLines,
  ]);

  const applyDraftLeave = (intent: DraftLeaveIntent) => {
    if (intent.type === "close") setSelectedInvoiceId(null);
    else if (intent.type === "select") setSelectedInvoiceId(intent.id);
    else setBillingTab(intent.next);
  };

  const tryDraftLeave = (intent: DraftLeaveIntent) => {
    if (!selectedInvoice || selectedInvoice.status !== "DRAFT" || !isDraftDirty) {
      applyDraftLeave(intent);
      return;
    }
    setPendingDraftLeave(intent);
    setDraftLeaveDialogOpen(true);
  };

  useEffect(() => {
    if (!newClientId && clients.length > 0) setNewClientId(clients[0].id);
  }, [clients, newClientId]);

  useEffect(() => {
    if (seriesForNewDraft.length === 0) {
      setNewSeriesId("");
      return;
    }
    if (!newSeriesId || !seriesForNewDraft.some((s) => s.id === newSeriesId)) {
      setNewSeriesId(seriesForNewDraft[0].id);
    }
  }, [seriesForNewDraft, newSeriesId]);

  useEffect(() => {
    if (!newSeriesIssuerId && activeIssuers.length > 0) setNewSeriesIssuerId(activeIssuers[0].id);
  }, [activeIssuers, newSeriesIssuerId]);

  useEffect(() => {
    if (!newIssuerId && activeIssuers.length > 0) setNewIssuerId(activeIssuers[0].id);
  }, [activeIssuers, newIssuerId]);

  /** Al abrir «Nueva factura (borrador)»: fecha factura = hoy, vencimiento = +2 meses (editable). */
  useEffect(() => {
    if (!newDraftFormOpen) return;
    const inv = new Date().toISOString().slice(0, 10);
    setNewInvoiceDate(inv);
    setNewDueDate(addCalendarMonthsYmd(inv, 2));
    setNewCopyLinesFromInvoiceId(NEW_DRAFT_COPY_LINES_NONE);
  }, [newDraftFormOpen]);

  useEffect(() => {
    setNewCopyLinesFromInvoiceId(NEW_DRAFT_COPY_LINES_NONE);
  }, [newClientId]);

  useEffect(() => {
    if (selectedInvoice?.status === "DRAFT") {
      setDraftIssuerId(selectedInvoice.issuerId);
      setDraftSeriesId(selectedInvoice.seriesId);
    }
  }, [selectedInvoice?.id, selectedInvoice?.issuerId, selectedInvoice?.seriesId, selectedInvoice?.status]);

  useEffect(() => {
    if (seriesForRectificative.length === 0) {
      setRectificativeSeriesId("");
      return;
    }
    if (!rectificativeSeriesId || !seriesForRectificative.some((s) => s.id === rectificativeSeriesId)) {
      setRectificativeSeriesId(seriesForRectificative[0].id);
    }
  }, [seriesForRectificative, rectificativeSeriesId]);

  useEffect(() => {
    let cancelled = false;
    if (!editingIssuerId) {
      setIssuerLogoPreviewUrl("");
      return;
    }
    const rec = issuers.find((x) => x.id === editingIssuerId);
    const path = rec?.logoStoragePath;
    if (!path) {
      setIssuerLogoPreviewUrl("");
      return;
    }
    void fetchBillingIssuerLogoDataUrl(path).then((url) => {
      if (!cancelled && url) setIssuerLogoPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [editingIssuerId, issuers]);

  /** Si el id seleccionado ya no está en la pestaña actual (p. ej. emitido o borrado), limpiar; no auto-abrir el primero. */
  useEffect(() => {
    const scope =
      billingTab === "drafts" ? draftInvoices : billingTab === "issued" ? issuedInvoicesFiltered : [];
    if (scope.length === 0) {
      setSelectedInvoiceId(null);
      return;
    }
    if (selectedInvoiceId && !scope.some((x) => x.id === selectedInvoiceId)) {
      setSelectedInvoiceId(null);
    }
  }, [billingTab, selectedInvoiceId, draftInvoices, issuedInvoicesFiltered]);

  useEffect(() => {
    if (!selectedInvoice) {
      setDraftDueDate("");
      setDraftIssueDate("");
      setDraftNotes("");
      setDraftRecipientAddresseeLine("");
      setDraftLines([]);
      return;
    }
    setDraftDueDate(selectedInvoice.dueDate ?? "");
    setDraftIssueDate(selectedInvoice.issueDate ?? "");
    setDraftNotes(selectedInvoice.notes ?? "");
    setDraftRecipientAddresseeLine(selectedInvoice.recipientAddresseeLine ?? "");
    setDraftLines(
      selectedInvoice.lines.map((line) => ({
        lineType: line.lineType ?? "BILLABLE",
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        billableHoursPercent: line.billableHoursPercent ?? 100,
        vatRate: line.vatRate as 21 | 10 | 4,
        irpfRate: line.irpfRate,
      }))
    );
  }, [selectedInvoice]);

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.billingIssuers });
    await qc.invalidateQueries({ queryKey: queryKeys.billingSeries });
    await qc.invalidateQueries({ queryKey: queryKeys.billingInvoices });
  };

  const closeIssuerForm = () => {
    setIssuerFormOpen(false);
    setEditingIssuerId(null);
    setIssuerCode("");
    setIssuerLegalName("");
    setIssuerTaxId("");
    setIssuerFiscalAddress("");
    setIssuerBankAccountIban("");
    setIssuerBankAccountSwift("");
    setIssuerBankName("");
    setIssuerEmail("");
    setIssuerPhone("");
    setIssuerWebsiteUrl("");
    setIssuerPrivacyFooterText("");
    setIssuerLogoPreviewUrl("");
  };

  const openNewIssuerForm = () => {
    setEditingIssuerId(null);
    setIssuerCode("");
    setIssuerLegalName("");
    setIssuerTaxId("");
    setIssuerFiscalAddress("");
    setIssuerBankAccountIban("");
    setIssuerBankAccountSwift("");
    setIssuerBankName("");
    setIssuerEmail("");
    setIssuerPhone("");
    setIssuerWebsiteUrl("");
    setIssuerPrivacyFooterText("");
    setIssuerLogoPreviewUrl("");
    setIssuerFormOpen(true);
  };

  const saveIssuerMutation = useMutation({
    mutationFn: () => {
      const payload = {
        code: issuerCode,
        legalName: issuerLegalName,
        taxId: issuerTaxId,
        fiscalAddress: issuerFiscalAddress,
        bankAccountIban: issuerBankAccountIban || null,
        bankAccountSwift: issuerBankAccountSwift || null,
        bankName: issuerBankName || null,
        email: issuerEmail || null,
        phone: issuerPhone || null,
        websiteUrl: issuerWebsiteUrl.trim() || null,
        privacyFooterText: isInormeInformaticaOrganizacionIssuer(issuerTaxId)
          ? null
          : issuerPrivacyFooterText.trim() || null,
      };
      if (editingIssuerId) return updateBillingIssuer(editingIssuerId, payload);
      return createBillingIssuer(payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.billingIssuers });
      closeIssuerForm();
      toast({ title: t("admin.billing.toast_issuer_saved") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const uploadIssuerLogoMutation = useMutation({
    mutationFn: ({ issuerId, file }: { issuerId: string; file: File }) => uploadBillingIssuerLogo(issuerId, file),
    onSuccess: async () => {
      await invalidateAll();
      toast({ title: t("admin.billing.toast_issuer_logo_saved") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const removeIssuerLogoMutation = useMutation({
    mutationFn: (issuerId: string) => removeBillingIssuerLogo(issuerId),
    onSuccess: async () => {
      setIssuerLogoPreviewUrl("");
      await invalidateAll();
      toast({ title: t("admin.billing.toast_issuer_logo_removed") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const toggleIssuerMutation = useMutation({
    mutationFn: ({ issuerId, active }: { issuerId: string; active: boolean }) =>
      setBillingIssuerActive(issuerId, active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.billingIssuers });
      toast({ title: t("admin.billing.toast_issuer_updated") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const createSeriesMutation = useMutation({
    mutationFn: () =>
      createBillingSeries({ issuerId: newSeriesIssuerId, code: newSeriesCode, label: newSeriesLabel }),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: queryKeys.billingSeries });
      setNewSeriesCode("");
      setNewSeriesLabel("");
      setSeriesCreateOpen(false);
      setNewIssuerId(created.issuerId);
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
        issuerId: newIssuerId,
        seriesId: newSeriesId,
        clientId: newClientId,
        issueDate: newInvoiceDate.trim() || null,
        dueDate: newDueDate || null,
        notes: newNotes,
        copyLinesFromInvoiceId:
          newCopyLinesFromInvoiceId !== NEW_DRAFT_COPY_LINES_NONE ? newCopyLinesFromInvoiceId : null,
      }),
    onSuccess: async (created) => {
      await invalidateAll();
      setNewDraftFormOpen(false);
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
      await updateBillingInvoiceDraftHeader(selectedInvoice.id, {
        dueDate: draftDueDate || null,
        issueDate: draftIssueDate.trim() || null,
        notes: draftNotes,
        issuerId: draftIssuerId || selectedInvoice.issuerId,
        seriesId: draftSeriesId || selectedInvoice.seriesId,
        recipientAddresseeLine: normInvoiceAddressee(draftRecipientAddresseeLine),
      });
      await replaceBillingInvoiceLines(selectedInvoice.id, draftLines);
    },
    onSuccess: async () => {
      await invalidateAll();
      const nav = afterDraftSaveNavRef.current;
      afterDraftSaveNavRef.current = null;
      if (nav?.type === "select") setSelectedInvoiceId(nav.id);
      else if (nav?.type === "tab") setBillingTab(nav.next);
      else setSelectedInvoiceId(null);
      toast({ title: t("admin.billing.toast_draft_saved") });
    },
    onError: (e) => {
      afterDraftSaveNavRef.current = null;
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    },
  });

  const emitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) throw new Error("Factura no encontrada.");
      await updateBillingInvoiceDraftHeader(selectedInvoice.id, {
        dueDate: draftDueDate || null,
        issueDate: draftIssueDate.trim() || null,
        notes: draftNotes,
        issuerId: draftIssuerId || selectedInvoice.issuerId,
        seriesId: draftSeriesId || selectedInvoice.seriesId,
        recipientAddresseeLine: normInvoiceAddressee(draftRecipientAddresseeLine),
      });
      await replaceBillingInvoiceLines(selectedInvoice.id, draftLines);
      await emitBillingInvoice(selectedInvoice.id, draftIssueDate.trim() || undefined);
    },
    onSuccess: async () => {
      await invalidateAll();
      setSelectedInvoiceId(null);
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
      setSelectedInvoiceId(null);
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
      if (!rectificativeSeriesId) throw new Error("Selecciona serie.");
      return createRectificativeDraftFromInvoice(selectedInvoice.id, rectificativeSeriesId);
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

  const duplicateDraftMutation = useMutation({
    mutationFn: (invoiceId: string) => duplicateBillingInvoiceDraft(invoiceId),
    onSuccess: async (created) => {
      await invalidateAll();
      setSelectedInvoiceId(created.id);
      toast({ title: t("admin.billing.toast_draft_duplicated") });
    },
    onError: (e) =>
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: (invoiceId: string) => deleteBillingInvoiceDraft(invoiceId),
    onSuccess: async (_, invoiceId) => {
      await invalidateAll();
      if (selectedInvoiceId === invoiceId) setSelectedInvoiceId(null);
      toast({ title: t("admin.billing.toast_draft_deleted") });
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
    <>
      <AlertDialog
        open={draftLeaveDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDraftLeaveDialogOpen(false);
            setPendingDraftLeave(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.billing.draft_unsaved_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.billing.draft_unsaved_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <AlertDialogCancel type="button">{t("admin.billing.draft_unsaved_stay")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const intent = pendingDraftLeave;
                setDraftLeaveDialogOpen(false);
                setPendingDraftLeave(null);
                if (intent) applyDraftLeave(intent);
              }}
            >
              {t("admin.billing.draft_unsaved_discard")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                const intent = pendingDraftLeave;
                setDraftLeaveDialogOpen(false);
                setPendingDraftLeave(null);
                if (!selectedInvoice) return;
                if (intent?.type === "select") afterDraftSaveNavRef.current = { type: "select", id: intent.id };
                else if (intent?.type === "tab") afterDraftSaveNavRef.current = { type: "tab", next: intent.next };
                else afterDraftSaveNavRef.current = null;
                saveDraftMutation.mutate();
              }}
              disabled={saveDraftMutation.isPending}
            >
              {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("admin.billing.draft_unsaved_save")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BadgeEuro className="h-6 w-6 text-primary" />
          {t("admin.billing.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("admin.billing.subtitle")}</p>
      </div>

      <Tabs
        value={billingTab}
        onValueChange={(v) => tryDraftLeave({ type: "tab", next: v as BillingTab })}
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="issuers">{t("admin.billing.tab_issuers")}</TabsTrigger>
          <TabsTrigger value="series">{t("admin.billing.tab_series")}</TabsTrigger>
          <TabsTrigger value="drafts">{t("admin.billing.tab_drafts")}</TabsTrigger>
          <TabsTrigger value="issued">{t("admin.billing.tab_issued")}</TabsTrigger>
        </TabsList>

        <TabsContent value="issuers" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.billing.issuers_list_title")}</CardTitle>
              <CardDescription>{t("admin.billing.issuer_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.billing.issuer_code")}</TableHead>
                      <TableHead>{t("admin.billing.issuer_legal_name")}</TableHead>
                      <TableHead>{t("admin.billing.issuer_tax_id")}</TableHead>
                      <TableHead>{t("admin.common.status")}</TableHead>
                      <TableHead className="text-right">{t("admin.common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issuers.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.code}</TableCell>
                        <TableCell>{i.legalName}</TableCell>
                        <TableCell>{i.taxId}</TableCell>
                        <TableCell>
                          <Badge variant={i.active ? "default" : "outline"}>
                            {i.active ? t("admin.billing.series_status_active") : t("admin.billing.series_status_inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingIssuerId(i.id);
                              setIssuerCode(i.code);
                              setIssuerLegalName(i.legalName);
                              setIssuerTaxId(i.taxId);
                              setIssuerFiscalAddress(i.fiscalAddress);
                              setIssuerBankAccountIban(i.bankAccountIban ?? "");
                              setIssuerBankAccountSwift(i.bankAccountSwift ?? "");
                              setIssuerBankName(i.bankName ?? "");
                              setIssuerEmail(i.email ?? "");
                              setIssuerPhone(i.phone ?? "");
                              setIssuerWebsiteUrl(i.websiteUrl ?? "");
                              setIssuerPrivacyFooterText(i.privacyFooterText ?? "");
                              setIssuerFormOpen(true);
                            }}
                          >
                            {t("admin.common.edit")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={toggleIssuerMutation.isPending}
                            onClick={() => toggleIssuerMutation.mutate({ issuerId: i.id, active: !i.active })}
                          >
                            {i.active ? t("admin.billing.series_disable") : t("admin.billing.series_enable")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="button" variant="secondary" onClick={openNewIssuerForm}>
                <Plus className="h-4 w-4 mr-2" />
                {t("admin.billing.issuer_new")}
              </Button>
            </CardContent>
          </Card>

          {issuerFormOpen ? (
            <Card>
              <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <CardTitle className="text-base">
                  {editingIssuerId ? t("admin.billing.issuer_form_edit") : t("admin.billing.issuer_form_create")}
                </CardTitle>
                <Button type="button" variant="ghost" size="sm" className="shrink-0 -mt-0.5" onClick={closeIssuerForm}>
                  <X className="h-4 w-4 mr-1" />
                  {t("admin.common.close")}
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("admin.billing.issuer_code")}</Label>
                <Input
                  value={issuerCode}
                  onChange={(e) => setIssuerCode(e.target.value.toUpperCase())}
                  placeholder={t("admin.billing.issuer_code_ph")}
                />
              </div>
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("admin.billing.issuer_website")}</Label>
                <Input
                  value={issuerWebsiteUrl}
                  onChange={(e) => setIssuerWebsiteUrl(e.target.value)}
                  placeholder={t("admin.billing.issuer_website_ph")}
                  inputMode="url"
                  autoComplete="url"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("admin.billing.issuer_privacy_footer")}</Label>
                <p className="text-xs text-muted-foreground">{t("admin.billing.issuer_privacy_footer_help")}</p>
                {isInormeInformaticaOrganizacionIssuer(issuerTaxId) ? (
                  <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                    {t("admin.billing.issuer_privacy_footer_inorme_fixed")}
                  </p>
                ) : (
                  <Textarea
                    value={issuerPrivacyFooterText}
                    onChange={(e) => setIssuerPrivacyFooterText(e.target.value)}
                    rows={5}
                    className="min-h-[100px] font-mono text-xs"
                    placeholder={t("admin.billing.issuer_privacy_footer_ph")}
                  />
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("admin.billing.issuer_logo")}</Label>
                <p className="text-xs text-muted-foreground">{t("admin.billing.issuer_logo_help")}</p>
                {editingIssuerId ? (
                  <>
                    {issuerLogoPreviewUrl ? (
                      <img src={issuerLogoPreviewUrl} alt="" className="max-h-20 object-contain object-left border rounded p-1 bg-muted/30" />
                    ) : null}
                    <Input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="cursor-pointer max-w-md"
                      disabled={uploadIssuerLogoMutation.isPending}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f && editingIssuerId) uploadIssuerLogoMutation.mutate({ issuerId: editingIssuerId, file: f });
                      }}
                    />
                    {issuers.find((i) => i.id === editingIssuerId)?.logoStoragePath ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={removeIssuerLogoMutation.isPending}
                        onClick={() => editingIssuerId && removeIssuerLogoMutation.mutate(editingIssuerId)}
                      >
                        {t("admin.billing.issuer_logo_remove")}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("admin.billing.issuer_logo_after_save")}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => saveIssuerMutation.mutate()} disabled={saveIssuerMutation.isPending}>
                  {saveIssuerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {t("admin.billing.issuer_save")}
                </Button>
              </div>
            </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="series" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="text-base">{t("admin.billing.series_title")}</CardTitle>
                <CardDescription>{t("admin.billing.series_desc")}</CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                {seriesCreateOpen ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSeriesCreateOpen(false)}>
                    <X className="h-4 w-4 mr-1" />
                    {t("admin.common.close")}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSeriesCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t("admin.billing.series_create")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {seriesCreateOpen ? (
                <>
                  <div className="flex flex-col gap-4 xl:hidden">
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-series-issuer-sm">{t("admin.billing.series_issuer")}</Label>
                      <Select value={newSeriesIssuerId} onValueChange={setNewSeriesIssuerId}>
                        <SelectTrigger id="billing-series-issuer-sm" className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {activeIssuers.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.code} · {i.legalName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-series-code-sm">{t("admin.billing.col_series")}</Label>
                      <Input
                        id="billing-series-code-sm"
                        placeholder={t("admin.billing.series_code_ph")}
                        value={newSeriesCode}
                        onChange={(e) => setNewSeriesCode(e.target.value.toUpperCase())}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-series-label-sm">{t("admin.common.name")}</Label>
                      <Input
                        id="billing-series-label-sm"
                        placeholder={t("admin.billing.series_label_ph")}
                        value={newSeriesLabel}
                        onChange={(e) => setNewSeriesLabel(e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <Button
                      type="button"
                      className="h-10 w-full shrink-0"
                      onClick={() => createSeriesMutation.mutate()}
                      disabled={createSeriesMutation.isPending || !newSeriesIssuerId}
                    >
                      {createSeriesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      {t("admin.billing.series_create")}
                    </Button>
                  </div>

                  <div className="hidden min-w-0 w-full gap-x-3 gap-y-1.5 xl:grid xl:grid-cols-[minmax(200px,1fr)_7rem_minmax(160px,1fr)_auto]">
                    <Label htmlFor="billing-series-issuer" className="block text-sm font-medium leading-none">
                      {t("admin.billing.series_issuer")}
                    </Label>
                    <Label htmlFor="billing-series-code" className="block text-sm font-medium leading-none text-muted-foreground">
                      {t("admin.billing.col_series")}
                    </Label>
                    <Label htmlFor="billing-series-label" className="block text-sm font-medium leading-none text-muted-foreground">
                      {t("admin.common.name")}
                    </Label>
                    <span className="block min-h-[1.25rem] select-none" aria-hidden />

                    <Select value={newSeriesIssuerId} onValueChange={setNewSeriesIssuerId}>
                      <SelectTrigger id="billing-series-issuer" className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activeIssuers.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.code} · {i.legalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="billing-series-code"
                      placeholder={t("admin.billing.series_code_ph")}
                      value={newSeriesCode}
                      onChange={(e) => setNewSeriesCode(e.target.value.toUpperCase())}
                      className="h-10"
                    />
                    <Input
                      id="billing-series-label"
                      placeholder={t("admin.billing.series_label_ph")}
                      value={newSeriesLabel}
                      onChange={(e) => setNewSeriesLabel(e.target.value)}
                      className="h-10"
                    />
                    <Button
                      type="button"
                      className="h-10 w-full shrink-0 whitespace-nowrap xl:w-auto"
                      onClick={() => createSeriesMutation.mutate()}
                      disabled={createSeriesMutation.isPending || !newSeriesIssuerId}
                    >
                      {createSeriesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      {t("admin.billing.series_create")}
                    </Button>
                  </div>
                </>
              ) : null}
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.billing.col_issuer")}</TableHead>
                      <TableHead>{t("admin.billing.col_series")}</TableHead>
                      <TableHead>{t("admin.common.name")}</TableHead>
                      <TableHead>{t("admin.common.status")}</TableHead>
                      <TableHead className="text-right">{t("admin.common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {series.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground text-sm">{issuerLabelById.get(s.issuerId) ?? "—"}</TableCell>
                        <TableCell className="font-medium">{s.code}</TableCell>
                        <TableCell>{s.label}</TableCell>
                        <TableCell>
                          <Badge variant={s.active ? "default" : "outline"}>
                            {s.active ? t("admin.billing.series_status_active") : t("admin.billing.series_status_inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-4 text-right align-middle">
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              disabled={toggleSeriesMutation.isPending}
                              onClick={() => toggleSeriesMutation.mutate({ seriesId: s.id, active: !s.active })}
                            >
                              {s.active ? t("admin.billing.series_disable") : t("admin.billing.series_enable")}
                            </Button>
                          </div>
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
            <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">{t("admin.billing.drafts_title")}</CardTitle>
                <CardDescription>{t("admin.billing.drafts_group_hint")}</CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                {newDraftFormOpen ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setNewDraftFormOpen(false)}>
                    <X className="h-4 w-4 mr-1" />
                    {t("admin.common.close")}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setNewDraftFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t("admin.billing.new_draft_title")}
                  </Button>
                )}
              </div>
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
                <div className="space-y-3">
                  {draftGrouped.map((ig, igIdx) => {
                    const issuerHeading = issuerLabelById.get(ig.issuerId) ?? ig.issuerCode;
                    const totalInIssuer = ig.yearBuckets.reduce(
                      (n, yb) => n + yb.monthBuckets.reduce((m, mb) => m + mb.items.length, 0),
                      0
                    );
                    return (
                      <Collapsible key={ig.issuerId} defaultOpen={igIdx === 0} className="rounded-md border bg-card text-card-foreground shadow-sm">
                        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50 [&[data-state=open]]:bg-muted/30 [&[data-state=open]>svg]:rotate-180">
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                          <span className="min-w-0 flex-1 truncate">{issuerHeading}</span>
                          <Badge variant="secondary">{totalInIssuer}</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-2 border-t px-2 py-3 sm:px-3">
                            {ig.yearBuckets.map((yb, yIdx) => {
                              const countYear = yb.monthBuckets.reduce((m, mb) => m + mb.items.length, 0);
                              const yearLabel =
                                yb.year > 0 ? String(yb.year) : t("admin.billing.group_year_unknown");
                              return (
                                <Collapsible
                                  key={`${ig.issuerId}-y${yb.year}`}
                                  defaultOpen={yIdx === 0}
                                  className="rounded-md border border-border/70 bg-muted/15"
                                >
                                  <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm font-semibold tabular-nums text-foreground hover:bg-muted/40 [&[data-state=open]]:bg-muted/30 [&[data-state=open]>svg]:rotate-180">
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
                                    <span className="min-w-0 flex-1 truncate">{yearLabel}</span>
                                    <Badge variant="secondary" className="font-normal">
                                      {countYear}
                                    </Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="space-y-2 border-t px-1.5 py-2">
                                      {yb.monthBuckets.map((mb, mbIdx) => {
                                        const monthLabel = formatInvoiceMonthOnly(
                                          localeTag,
                                          mb.month,
                                          t("admin.billing.group_month_unknown")
                                        );
                                        return (
                                          <Collapsible
                                            key={`${ig.issuerId}-${mb.key}`}
                                            defaultOpen={yIdx === 0 && mbIdx === 0}
                                            className="rounded-md border border-border/80 bg-muted/25"
                                          >
                                            <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50 [&[data-state=open]]:bg-muted/40 [&[data-state=open]>svg]:rotate-180">
                                              <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
                                              <span className="min-w-0 flex-1 truncate normal-case">{monthLabel}</span>
                                              <Badge variant="outline" className="font-normal normal-case">
                                                {mb.items.length}
                                              </Badge>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                              <div className="border-t px-1 pb-2 pt-1">
                                                <div className="rounded-md border bg-background overflow-x-auto">
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead>{t("admin.billing.col_invoice")}</TableHead>
                                                        <TableHead>{t("admin.billing.col_client")}</TableHead>
                                                        <TableHead>{t("admin.billing.col_notes")}</TableHead>
                                                        <TableHead className="text-right">{t("admin.common.actions")}</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                      {mb.items.map((inv) => (
                                                        <TableRow key={inv.id}>
                                                          <TableCell className="font-medium">{`${inv.seriesCode}-BORRADOR`}</TableCell>
                                                          <TableCell>{inv.recipientName || "—"}</TableCell>
                                                          <TableCell className="max-w-[min(28rem,45vw)]">
                                                            <span
                                                              className="line-clamp-2 text-sm"
                                                              title={inv.notes?.trim() ? inv.notes.trim() : undefined}
                                                            >
                                                              {inv.notes?.trim() ? inv.notes.trim() : "—"}
                                                            </span>
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                            <div className="inline-flex flex-wrap items-center justify-end gap-1">
                                                              <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => tryDraftLeave({ type: "select", id: inv.id })}
                                                              >
                                                                {t("admin.billing.action_open")}
                                                              </Button>
                                                              <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => duplicateDraftMutation.mutate(inv.id)}
                                                                disabled={duplicateDraftMutation.isPending}
                                                                title={t("admin.billing.action_duplicate_draft")}
                                                              >
                                                                {duplicateDraftMutation.isPending ? (
                                                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                  <Copy className="h-3.5 w-3.5" />
                                                                )}
                                                              </Button>
                                                              <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                                                onClick={() => {
                                                                  if (!window.confirm(t("admin.billing.delete_draft_confirm"))) return;
                                                                  deleteDraftMutation.mutate(inv.id);
                                                                }}
                                                                disabled={deleteDraftMutation.isPending}
                                                                title={t("admin.billing.action_delete_draft")}
                                                              >
                                                                {deleteDraftMutation.isPending ? (
                                                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                  <Trash2 className="h-3.5 w-3.5" />
                                                                )}
                                                              </Button>
                                                            </div>
                                                          </TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              </div>
                                            </CollapsibleContent>
                                          </Collapsible>
                                        );
                                      })}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {newDraftFormOpen ? (
            <Card>
              <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{t("admin.billing.new_draft_title")}</CardTitle>
                  <CardDescription>{t("admin.billing.new_draft_desc")}</CardDescription>
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setNewDraftFormOpen(false)}>
                  <X className="h-4 w-4 mr-1" />
                  {t("admin.common.close")}
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("admin.billing.col_issuer")}</Label>
                  <Select value={newIssuerId} onValueChange={setNewIssuerId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeIssuers.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.code} · {i.legalName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.billing.col_series")}</Label>
                  <Select value={newSeriesId} onValueChange={setNewSeriesId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {seriesForNewDraft.map((s) => (
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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("admin.billing.new_draft_copy_lines_label")}</Label>
                  <p className="text-xs text-muted-foreground">{t("admin.billing.new_draft_copy_lines_hint")}</p>
                  {invoicesForNewDraftLineCopy.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("admin.billing.new_draft_copy_lines_empty")}</p>
                  ) : (
                    <Select value={newCopyLinesFromInvoiceId} onValueChange={setNewCopyLinesFromInvoiceId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NEW_DRAFT_COPY_LINES_NONE}>{t("admin.billing.new_draft_copy_lines_none")}</SelectItem>
                        {invoicesForNewDraftLineCopy.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {formatInvoiceCopySourceLabel(inv, localeTag, t("admin.billing.copy_source_draft_marker"))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.billing.invoice_date_field")}</Label>
                  <Input
                    type="date"
                    value={newInvoiceDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewInvoiceDate(v);
                      if (v) setNewDueDate(addCalendarMonthsYmd(v, 2));
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.billing.col_due_date")}</Label>
                  <p className="text-xs text-muted-foreground">{t("admin.billing.new_draft_due_hint")}</p>
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
                    disabled={createDraftMutation.isPending || !newIssuerId || !newSeriesId || !newClientId}
                  >
                    {createDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    {t("admin.billing.action_create_draft")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="issued" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("admin.billing.issued_filters_title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("admin.billing.search_ph")}</Label>
                <Input
                  placeholder={t("admin.billing.search_ph")}
                  value={issuedSearch}
                  onChange={(e) => setIssuedSearch(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.col_issuer")}</Label>
                <Select value={issuedIssuerIdFilter} onValueChange={setIssuedIssuerIdFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.common.filter_all")}</SelectItem>
                    {issuers.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.code} · {i.legalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <CardHeader className="pb-2 space-y-1">
              <CardTitle className="text-base">{t("admin.billing.issued_title")}</CardTitle>
              <CardDescription>{t("admin.billing.issued_group_hint")}</CardDescription>
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
                <div className="space-y-3">
                  {issuedGrouped.map((ig, igIdx) => {
                    const issuerHeading = issuerLabelById.get(ig.issuerId) ?? ig.issuerCode;
                    const totalInIssuer = ig.yearBuckets.reduce(
                      (n, yb) => n + yb.monthBuckets.reduce((m, mb) => m + mb.items.length, 0),
                      0
                    );
                    return (
                      <Collapsible key={ig.issuerId} defaultOpen={igIdx === 0} className="rounded-md border bg-card text-card-foreground shadow-sm">
                        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50 [&[data-state=open]]:bg-muted/30 [&[data-state=open]>svg]:rotate-180">
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                          <span className="min-w-0 flex-1 truncate">{issuerHeading}</span>
                          <Badge variant="secondary">{totalInIssuer}</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-2 border-t px-2 py-3 sm:px-3">
                            {ig.yearBuckets.map((yb, yIdx) => {
                              const countYear = yb.monthBuckets.reduce((m, mb) => m + mb.items.length, 0);
                              const yearLabel =
                                yb.year > 0 ? String(yb.year) : t("admin.billing.group_year_unknown");
                              return (
                                <Collapsible
                                  key={`${ig.issuerId}-y${yb.year}`}
                                  defaultOpen={yIdx === 0}
                                  className="rounded-md border border-border/70 bg-muted/15"
                                >
                                  <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm font-semibold tabular-nums text-foreground hover:bg-muted/40 [&[data-state=open]]:bg-muted/30 [&[data-state=open]>svg]:rotate-180">
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
                                    <span className="min-w-0 flex-1 truncate">{yearLabel}</span>
                                    <Badge variant="secondary" className="font-normal">
                                      {countYear}
                                    </Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="space-y-2 border-t px-1.5 py-2">
                                      {yb.monthBuckets.map((mb, mbIdx) => {
                                        const monthLabel = formatInvoiceMonthOnly(
                                          localeTag,
                                          mb.month,
                                          t("admin.billing.group_month_unknown")
                                        );
                                        return (
                                          <Collapsible
                                            key={`${ig.issuerId}-${mb.key}`}
                                            defaultOpen={yIdx === 0 && mbIdx === 0}
                                            className="rounded-md border border-border/80 bg-muted/25"
                                          >
                                            <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50 [&[data-state=open]]:bg-muted/40 [&[data-state=open]>svg]:rotate-180">
                                              <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
                                              <span className="min-w-0 flex-1 truncate normal-case">{monthLabel}</span>
                                              <Badge variant="outline" className="font-normal normal-case">
                                                {mb.items.length}
                                              </Badge>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                              <div className="border-t px-1 pb-2 pt-1">
                                                <div className="rounded-md border bg-background overflow-x-auto">
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
                                                      {mb.items.map((inv) => {
                                                        const number =
                                                          inv.invoiceNumber != null && inv.fiscalYear != null
                                                            ? `${inv.seriesCode}-${inv.fiscalYear}/${String(inv.invoiceNumber).padStart(4, "0")}`
                                                            : `${inv.seriesCode}-?`;
                                                        return (
                                                          <TableRow key={inv.id}>
                                                            <TableCell className="font-medium">{number}</TableCell>
                                                            <TableCell>
                                                              <Badge variant={variantByStatus(inv.status)}>{inv.status}</Badge>
                                                            </TableCell>
                                                            <TableCell>{inv.recipientName || "—"}</TableCell>
                                                            <TableCell>{inv.issueDate ?? "—"}</TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                              {inv.grandTotal.toLocaleString(localeTag, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                              })}{" "}
                                                              €
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                              <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => tryDraftLeave({ type: "select", id: inv.id })}
                                                              >
                                                                {t("admin.billing.action_open")}
                                                              </Button>
                                                            </TableCell>
                                                          </TableRow>
                                                        );
                                                      })}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              </div>
                                            </CollapsibleContent>
                                          </Collapsible>
                                        );
                                      })}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedInvoice && (billingTab === "drafts" || billingTab === "issued") ? (
        <Card>
          <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">
                {selectedInvoice.invoiceNumber && selectedInvoice.fiscalYear
                  ? `${selectedInvoice.issuerCode} · ${selectedInvoice.seriesCode}-${selectedInvoice.fiscalYear}/${String(selectedInvoice.invoiceNumber).padStart(4, "0")}`
                  : `${selectedInvoice.issuerCode} · ${seriesById.get(selectedInvoice.seriesId)?.code ?? "?"} · ${t("admin.billing.draft_label")}`}
              </CardTitle>
              <CardDescription>
                {selectedInvoice.recipientName} · {selectedInvoice.recipientTaxId}
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => tryDraftLeave({ type: "close" })}>
              <X className="h-4 w-4 mr-1" />
              {t("admin.common.close")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {editable ? (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("admin.billing.col_issuer")}</Label>
                    <Select
                      value={draftIssuerId}
                      onValueChange={(v) => {
                        setDraftIssuerId(v);
                        const first = series.find((s) => s.issuerId === v && s.active);
                        if (first) setDraftSeriesId(first.id);
                        if (selectedInvoice?.status === "DRAFT" && first) {
                          void updateBillingInvoiceDraftHeader(selectedInvoice.id, {
                            issuerId: v,
                            seriesId: first.id,
                          }).then(() => qc.invalidateQueries({ queryKey: queryKeys.billingInvoices }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {issuersSelectableForDraft.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.code} · {i.legalName}
                            {!i.active ? ` (${t("admin.billing.issuer_inactive_label")})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.billing.col_series")}</Label>
                    <Select
                      value={draftSeriesId}
                      onValueChange={(v) => {
                        setDraftSeriesId(v);
                        if (selectedInvoice?.status === "DRAFT") {
                          void updateBillingInvoiceDraftHeader(selectedInvoice.id, { seriesId: v }).then(() =>
                            qc.invalidateQueries({ queryKey: queryKeys.billingInvoices })
                          );
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesSelectableForDraft.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.code} · {s.label}
                            {!s.active ? ` (${t("admin.billing.series_status_inactive")})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("admin.billing.col_issuer")}</Label>
                    <Input value={`${selectedInvoice.issuerCode} · ${selectedInvoice.issuerName}`} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.billing.col_series")}</Label>
                    <Input
                      value={`${selectedInvoice.seriesCode} · ${seriesById.get(selectedInvoice.seriesId)?.label ?? ""}`}
                      disabled
                    />
                  </div>
                </>
              )}
              <div className="space-y-2 sm:col-span-1">
                <div className="space-y-1.5">
                  <Label>{t("admin.billing.invoice_date_field")}</Label>
                  {editable ? (
                    <>
                      <Input
                        type="date"
                        value={draftIssueDate}
                        onChange={(e) => setDraftIssueDate(e.target.value)}
                        className="h-9 max-w-[220px] text-sm font-medium"
                      />
                      <p className="text-xs text-muted-foreground">{t("admin.billing.invoice_date_hint_draft")}</p>
                    </>
                  ) : (
                    <Input value={selectedInvoice.issueDate ?? ""} disabled placeholder="—" className="font-medium" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-normal text-muted-foreground">{t("admin.billing.col_due_date")}</Label>
                  <Input
                    type="date"
                    value={draftDueDate}
                    onChange={(e) => setDraftDueDate(e.target.value)}
                    disabled={!editable}
                    className="h-9 max-w-[220px] text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.billing.col_payment_status")}</Label>
                <Input value={selectedInvoice.paymentStatus} disabled />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("admin.billing.col_notes")}</Label>
                <Textarea rows={2} value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} disabled={!editable} />
              </div>
              {editable && invoiceAddresseeSelectOptions.length > 0 ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("admin.billing.invoice_addressee_label")}</Label>
                  <p className="text-xs text-muted-foreground">{t("admin.billing.invoice_addressee_hint")}</p>
                  <Select
                    value={draftRecipientAddresseeLine ? draftRecipientAddresseeLine : "__none__"}
                    onValueChange={(v) => setDraftRecipientAddresseeLine(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("admin.billing.invoice_addressee_none")}</SelectItem>
                      {invoiceAddresseeSelectOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt.length > 96 ? `${opt.slice(0, 93)}…` : opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : !editable && selectedInvoice.recipientAddresseeLine?.trim() ? (
                <div className="space-y-1 sm:col-span-2 text-sm">
                  <span className="text-muted-foreground">{t("admin.billing.invoice_addressee_label")}: </span>
                  <span>{selectedInvoice.recipientAddresseeLine.trim()}</span>
                </div>
              ) : null}
            </div>

            {editable ? (
              <p className="text-xs text-muted-foreground -mt-1 mb-1">{t("admin.billing.line_concept_rich_hint")}</p>
            ) : null}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">{t("admin.billing.col_line_type")}</TableHead>
                    <TableHead>{t("admin.billing.col_concept")}</TableHead>
                    <TableHead className="w-[90px]">{t("admin.billing.col_qty")}</TableHead>
                    <TableHead className="w-[88px]">{t("admin.billing.col_billable_hours_pct")}</TableHead>
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
                                        billableHoursPercent: x.billableHoursPercent ?? 100,
                                      }
                                    : {
                                        ...x,
                                        lineType: v as BillingInvoiceLineInput["lineType"],
                                        quantity: 0,
                                        unitPrice: 0,
                                        irpfRate: 0,
                                        billableHoursPercent: 100,
                                      }
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
                        <Textarea
                          rows={2}
                          className="min-h-[52px] max-w-md text-sm resize-y"
                          value={line.description}
                          disabled={!editable}
                          onChange={(e) =>
                            setDraftLines((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[5.5rem]">
                          <Input
                            type="number"
                            step="0.01"
                            value={line.quantity}
                            disabled={!editable || line.lineType !== "BILLABLE"}
                            onChange={(e) =>
                              setDraftLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value || 0) } : x)))
                            }
                          />
                          {line.lineType === "BILLABLE" && isPartialBillableHoursPct(line) ? (
                            <div className="text-right text-xs leading-tight tabular-nums">
                              <div>
                                <span className="line-through text-muted-foreground">
                                  {line.quantity.toLocaleString(localeTag, { maximumFractionDigits: 4 })}
                                </span>
                              </div>
                              <div className="font-medium text-foreground">
                                {effectiveBillableQuantity(line).toLocaleString(localeTag, {
                                  maximumFractionDigits: 4,
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0.01}
                          max={100}
                          step="0.01"
                          title={t("admin.billing.col_billable_hours_pct_hint")}
                          value={line.billableHoursPercent ?? 100}
                          disabled={!editable || line.lineType !== "BILLABLE"}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setDraftLines((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      billableHoursPercent: Number.isFinite(n)
                                        ? Math.min(100, Math.max(0.01, Math.round(n * 10000) / 10000))
                                        : 100,
                                    }
                                  : x
                              )
                            );
                          }}
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
                {editable ? (
                  <TableFooter>
                    <TableRow className="bg-muted/40 border-t-2 border-border">
                      <TableCell colSpan={2} className="text-muted-foreground align-top py-3 text-sm font-medium">
                        {t("admin.billing.draft_totals_preview_title")}
                      </TableCell>
                      <TableCell colSpan={5} className="text-right align-top py-3">
                        <div className="inline-flex flex-col gap-1 text-sm tabular-nums sm:min-w-[16rem]">
                          <div className="flex justify-end gap-6">
                            <span className="text-muted-foreground font-normal">{t("admin.billing.draft_totals_base")}</span>
                            <span className="min-w-[7.5rem]">
                              {draftBillableTotalsPreview.taxableBaseTotal.toLocaleString(localeTag, {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </span>
                          </div>
                          <div className="flex justify-end gap-6">
                            <span className="text-muted-foreground font-normal">{t("admin.billing.draft_totals_vat")}</span>
                            <span className="min-w-[7.5rem]">
                              {draftBillableTotalsPreview.vatTotal.toLocaleString(localeTag, {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </span>
                          </div>
                          <div className="flex justify-end gap-6">
                            <span className="text-muted-foreground font-normal">{t("admin.billing.draft_totals_irpf")}</span>
                            <span className="min-w-[7.5rem]">
                              {draftBillableTotalsPreview.irpfTotal.toLocaleString(localeTag, {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </span>
                          </div>
                          <div className="flex justify-end gap-6 border-t border-border/80 pt-1 mt-0.5 font-semibold text-foreground">
                            <span>{t("admin.billing.draft_totals_grand")}</span>
                            <span className="min-w-[7.5rem]">
                              {draftBillableTotalsPreview.grandTotal.toLocaleString(localeTag, {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>

            <div className="flex flex-wrap gap-2">
              {editable ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setDraftLines((prev) => [...prev, emptyLine()])}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("admin.billing.action_add_line")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
                    {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {t("admin.billing.action_save_draft")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (!selectedInvoice) return;
                      const header = mergeProformaHeaderFromForm(
                        selectedInvoice,
                        draftIssuerId || selectedInvoice.issuerId,
                        issuers,
                        draftDueDate,
                        draftIssueDate,
                        draftNotes,
                        draftRecipientAddresseeLine,
                        series,
                        draftSeriesId || selectedInvoice.seriesId,
                        clients
                      );
                      toast({
                        title: t("admin.billing.pdf_proforma_loading_title"),
                        description: t("admin.billing.pdf_proforma_loading_desc"),
                      });
                      void openBillingInvoiceProformaDownload(header, draftLines)
                        .then(() =>
                          toast({
                            title: t("admin.billing.pdf_proforma_ready_title"),
                            description: t("admin.billing.pdf_proforma_ready_desc"),
                          })
                        )
                        .catch((e) =>
                          toast({
                            title: t("admin.common.error"),
                            description: e instanceof Error ? e.message : "",
                            variant: "destructive",
                          })
                        );
                    }}
                  >
                    <FileSearch className="h-4 w-4 mr-2" />
                    {t("admin.billing.action_pdf_proforma")}
                  </Button>
                  <Button type="button" onClick={() => emitMutation.mutate()} disabled={emitMutation.isPending}>
                    {emitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {t("admin.billing.action_emit")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => selectedInvoice && duplicateDraftMutation.mutate(selectedInvoice.id)}
                    disabled={duplicateDraftMutation.isPending || !selectedInvoice}
                  >
                    {duplicateDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {t("admin.billing.action_duplicate_draft")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => {
                      if (!selectedInvoice) return;
                      if (!window.confirm(t("admin.billing.delete_draft_confirm"))) return;
                      deleteDraftMutation.mutate(selectedInvoice.id);
                    }}
                    disabled={deleteDraftMutation.isPending || !selectedInvoice}
                  >
                    {deleteDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    {t("admin.billing.action_delete_draft")}
                  </Button>
                </>
              ) : (
                <div className="flex w-full flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: t("admin.billing.pdf_invoice_loading_title"),
                          description: t("admin.billing.pdf_invoice_loading_desc"),
                        });
                        void openBillingInvoicePdfDownload(selectedInvoice)
                          .then(() =>
                            toast({
                              title: t("admin.billing.pdf_invoice_ready_title"),
                              description: t("admin.billing.pdf_invoice_ready_desc"),
                            })
                          )
                          .catch((e) =>
                            toast({
                              title: t("admin.common.error"),
                              description:
                                e instanceof BillingPdfMissingTraceabilityError
                                  ? t("admin.billing.pdf_error_missing_traceability")
                                  : e instanceof Error
                                    ? e.message
                                    : "",
                              variant: "destructive",
                            })
                          );
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {t("admin.billing.action_pdf")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => rectificativeMutation.mutate()}
                      disabled={rectificativeMutation.isPending || !rectificativeSeriesId || seriesForRectificative.length === 0}
                    >
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
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <Label className="text-xs">{t("admin.billing.rectificative_series")}</Label>
                    <Select value={rectificativeSeriesId} onValueChange={setRectificativeSeriesId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesForRectificative.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.code} · {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
    </>
  );
};

export default AdminBilling;

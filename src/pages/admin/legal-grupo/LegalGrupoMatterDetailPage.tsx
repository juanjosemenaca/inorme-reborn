import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  createLegalCalendarEvent,
  createLegalInvoice,
  createLegalMatterActivity,
  createLegalProcedure,
  createLegalTimeEntry,
  getLegalDocumentSignedUrl,
  uploadLegalDocument,
} from "@/api/legalGrupoApi";
import { queryKeys } from "@/lib/queryKeys";
import {
  useLegalCalendarEvents,
  useLegalClients,
  useLegalDocuments,
  useLegalInvoices,
  useLegalMatter,
  useLegalMatterActivities,
  useLegalProcedures,
  useLegalTimeEntries,
} from "@/hooks/useLegalGrupo";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { LegalCalendarEventType } from "@/types/legalGrupo";
import { ArrowLeft, Loader2 } from "lucide-react";

const LegalGrupoMatterDetailPage = () => {
  const { matterId } = useParams<{ matterId: string }>();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAdminAuth();
  const qc = useQueryClient();
  const { data: matter, isLoading } = useLegalMatter(matterId);
  const { data: clients = [] } = useLegalClients();
  const clientName = useMemo(
    () => clients.find((c) => c.id === matter?.legalClientId)?.displayName ?? "—",
    [clients, matter?.legalClientId]
  );

  const { data: activities = [] } = useLegalMatterActivities(matterId);
  const { data: documents = [] } = useLegalDocuments(matterId);
  const { data: procedures = [] } = useLegalProcedures(matterId);
  const { data: timeEntries = [] } = useLegalTimeEntries({ matterId }, !!matterId);
  const { data: invoices = [] } = useLegalInvoices();

  const range = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      matterId,
    };
  }, [matterId]);
  const { data: calEvents = [] } = useLegalCalendarEvents(matterId ? range : null);

  const [actTitle, setActTitle] = useState("");
  const [actBody, setActBody] = useState("");
  const addAct = useMutation({
    mutationFn: () =>
      createLegalMatterActivity({
        matterId: matterId!,
        title: actTitle,
        body: actBody,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.legalMatterActivities(matterId!) });
      setActTitle("");
      setActBody("");
      toast({ title: t("admin.legal.toast_activity_added") });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const [procCourt, setProcCourt] = useState("");
  const [procNum, setProcNum] = useState("");
  const addProc = useMutation({
    mutationFn: () =>
      createLegalProcedure({
        matterId: matterId!,
        courtName: procCourt,
        procedureNumber: procNum,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.legalProcedures(matterId!) });
      setProcCourt("");
      setProcNum("");
      toast({ title: t("admin.legal.toast_procedure_added") });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const [hours, setHours] = useState("1");
  const [timeDesc, setTimeDesc] = useState("");
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const addTime = useMutation({
    mutationFn: () =>
      createLegalTimeEntry({
        matterId: matterId!,
        backofficeUserId: user!.userId,
        workDate,
        hours: Number(hours.replace(",", ".")),
        description: timeDesc,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.legalTimeEntries(matterId!) });
      toast({ title: t("admin.legal.toast_time_added") });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const [evTitle, setEvTitle] = useState("");
  const [evStart, setEvStart] = useState("");
  const [evType, setEvType] = useState<LegalCalendarEventType>("DEADLINE");
  const addEv = useMutation({
    mutationFn: () =>
      createLegalCalendarEvent({
        matterId: matterId!,
        eventType: evType,
        title: evTitle,
        startsAt: new Date(evStart).toISOString(),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "legalCalendarEvents" });
      setEvTitle("");
      toast({ title: t("admin.legal.toast_event_added") });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const addInv = useMutation({
    mutationFn: () =>
      createLegalInvoice({
        legalClientId: matter!.legalClientId,
        matterId: matter!.id,
        lines: [
          {
            lineOrder: 1,
            lineType: "HOURLY",
            description: t("admin.legal.invoice_default_line"),
            quantity: 1,
            unitPrice: 0,
          },
        ],
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.legalInvoices });
      toast({ title: t("admin.legal.toast_invoice_created") });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const upDoc = useMutation({
    mutationFn: () => uploadLegalDocument({ matterId: matterId!, file: file!, name: docName || file!.name }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.legalDocuments(matterId!) });
      setFile(null);
      setDocName("");
      toast({ title: t("admin.legal.toast_doc_uploaded") });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const downloadDoc = async (path: string) => {
    try {
      const url = await getLegalDocumentSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  if (isLoading || !matterId) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!matter) {
    return <p className="text-muted-foreground">{t("admin.legal.matter_not_found")}</p>;
  }

  const matterInvoices = invoices.filter((i) => i.matterId === matter.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link to="/admin/grupo-legal/expedientes">
            <ArrowLeft className="h-4 w-4" />
            {t("admin.legal.back_matters")}
          </Link>
        </Button>
        <Badge variant={matter.status === "CLOSED" ? "secondary" : "default"}>{t(`admin.legal.status_${matter.status}`)}</Badge>
      </div>
      <div>
        <h2 className="text-xl font-bold">{matter.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("admin.legal.field_legal_client")}: {clientName} · {t(`admin.legal.matter_type_${matter.matterType}`)}
        </p>
        {matter.matterCode && (
          <p className="text-sm text-muted-foreground">
            {t("admin.legal.field_matter_code")}: {matter.matterCode}
          </p>
        )}
      </div>

      <Tabs defaultValue="activity">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="activity">{t("admin.legal.tab_activity")}</TabsTrigger>
          <TabsTrigger value="documents">{t("admin.legal.tab_documents")}</TabsTrigger>
          <TabsTrigger value="procedures">{t("admin.legal.tab_procedures")}</TabsTrigger>
          <TabsTrigger value="time">{t("admin.legal.tab_time")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("admin.legal.tab_calendar")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("admin.legal.tab_invoices")}</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.legal.new_activity")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder={t("admin.legal.activity_title_ph")} value={actTitle} onChange={(e) => setActTitle(e.target.value)} />
              <Textarea placeholder={t("admin.legal.activity_body_ph")} value={actBody} onChange={(e) => setActBody(e.target.value)} />
              <Button size="sm" disabled={!actTitle.trim() || addAct.isPending} onClick={() => addAct.mutate()}>
                {addAct.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.legal.add")}
              </Button>
            </CardContent>
          </Card>
          <ul className="space-y-2">
            {activities.map((a) => (
              <li key={a.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{a.title}</p>
                <p className="text-muted-foreground text-xs">{new Date(a.occurredAt).toLocaleString()}</p>
                {a.body && <p className="mt-2 whitespace-pre-wrap">{a.body}</p>}
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.legal.upload_document")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Input placeholder={t("admin.legal.doc_name_ph")} value={docName} onChange={(e) => setDocName(e.target.value)} />
              <Button size="sm" disabled={!file || upDoc.isPending} onClick={() => upDoc.mutate()}>
                {upDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.legal.upload")}
              </Button>
            </CardContent>
          </Card>
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>
                  {d.name} <span className="text-muted-foreground">v{d.version}</span>
                </span>
                <Button variant="outline" size="sm" type="button" onClick={() => downloadDoc(d.storagePath)}>
                  {t("admin.legal.download")}
                </Button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="procedures" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.legal.new_procedure")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("admin.legal.field_court")}</Label>
                <Input value={procCourt} onChange={(e) => setProcCourt(e.target.value)} />
              </div>
              <div>
                <Label>{t("admin.legal.field_procedure_number")}</Label>
                <Input value={procNum} onChange={(e) => setProcNum(e.target.value)} />
              </div>
              <Button className="sm:col-span-2 w-fit" size="sm" disabled={addProc.isPending} onClick={() => addProc.mutate()}>
                {addProc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.legal.add")}
              </Button>
            </CardContent>
          </Card>
          <ul className="space-y-2 text-sm">
            {procedures.map((p) => (
              <li key={p.id} className="border rounded-md p-3">
                <p className="font-medium">{p.courtName || "—"}</p>
                <p>{p.procedureNumber}</p>
                <p className="text-muted-foreground">{p.proceduralStatus}</p>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="time" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.legal.new_time_entry")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>{t("admin.legal.field_date")}</Label>
                <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
              </div>
              <div>
                <Label>{t("admin.legal.field_hours")}</Label>
                <Input value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
              <div className="sm:col-span-3">
                <Label>{t("admin.legal.field_description")}</Label>
                <Input value={timeDesc} onChange={(e) => setTimeDesc(e.target.value)} />
              </div>
              <Button className="w-fit" size="sm" disabled={!user || addTime.isPending} onClick={() => addTime.mutate()}>
                {addTime.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.legal.add")}
              </Button>
            </CardContent>
          </Card>
          <ul className="space-y-1 text-sm">
            {timeEntries.map((te) => (
              <li key={te.id} className="flex justify-between border-b py-2">
                <span>
                  {te.workDate} — {te.hours} h
                </span>
                <span className="text-muted-foreground truncate max-w-[50%]">{te.description}</span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.legal.new_event")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div>
                <Label>{t("admin.legal.field_event_type")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={evType}
                  onChange={(e) => setEvType(e.target.value as LegalCalendarEventType)}
                >
                  <option value="HEARING">{t("admin.legal.ev_hearing")}</option>
                  <option value="DEADLINE">{t("admin.legal.ev_deadline")}</option>
                  <option value="MEETING">{t("admin.legal.ev_meeting")}</option>
                  <option value="OTHER">{t("admin.legal.ev_other")}</option>
                </select>
              </div>
              <div>
                <Label>{t("admin.legal.field_matter_title")}</Label>
                <Input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
              </div>
              <div>
                <Label>{t("admin.legal.field_datetime_local")}</Label>
                <Input type="datetime-local" value={evStart} onChange={(e) => setEvStart(e.target.value)} />
              </div>
              <Button size="sm" disabled={!evTitle.trim() || !evStart || addEv.isPending} onClick={() => addEv.mutate()}>
                {addEv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.legal.add")}
              </Button>
            </CardContent>
          </Card>
          <ul className="space-y-2 text-sm">
            {calEvents.map((ev) => (
              <li key={ev.id} className="border rounded-md p-3">
                <p className="font-medium">{ev.title}</p>
                <p className="text-muted-foreground">{new Date(ev.startsAt).toLocaleString()}</p>
                <Badge variant="outline" className="mt-1">
                  {ev.eventType === "HEARING"
                    ? t("admin.legal.ev_hearing")
                    : ev.eventType === "DEADLINE"
                      ? t("admin.legal.ev_deadline")
                      : ev.eventType === "MEETING"
                        ? t("admin.legal.ev_meeting")
                        : t("admin.legal.ev_other")}
                </Badge>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-4">
          <Button size="sm" onClick={() => addInv.mutate()} disabled={addInv.isPending}>
            {addInv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.legal.invoice_create_draft")}
          </Button>
          <ul className="space-y-2 text-sm">
            {matterInvoices.map((inv) => (
              <li key={inv.id} className="flex justify-between border rounded-md p-3">
                <span>
                  {inv.invoiceNumber || inv.id.slice(0, 8)} — {inv.status}
                </span>
                <span>{inv.grandTotal.toFixed(2)} €</span>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LegalGrupoMatterDetailPage;

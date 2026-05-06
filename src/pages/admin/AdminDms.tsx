import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Download,
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { fetchClients } from "@/api/clientsApi";
import {
  assignDmsDocumentReview,
  createDmsDocumentWithInitialVersion,
  deleteDmsDocument,
  dmsListFiltersKey,
  getDmsVersionSignedUrl,
  listDmsDocumentLogs,
  listDmsDocumentPermissions,
  listDmsDocumentReviews,
  listDmsDocumentVersions,
  listDmsDocuments,
  removeDmsDocumentPermission,
  resolveDmsDocumentReview,
  setDmsDocumentPermission,
  type DmsListFilters,
  updateDmsDocumentMetadata,
  uploadDmsDocumentVersion,
} from "@/api/dmsDocumentsApi";
import { fetchBackofficeUsers } from "@/api/backofficeUsersApi";
import { fetchCompanyWorkers } from "@/api/companyWorkersApi";
import { fetchProjectsWithDocuments } from "@/api/projectsApi";
import { fetchWorkCalendarSites } from "@/api/workCalendarSitesApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DmsWorkerReviewPanel } from "@/components/admin/DmsWorkerReviewPanel";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import type { DmsDocumentRecord, DmsDocumentType, DmsReviewStatus } from "@/types/dmsDocuments";

const DOCUMENT_TYPES: DmsDocumentType[] = [
  "CONTRACT",
  "INVOICE",
  "REPORT",
  "CORRESPONDENCE",
  "CERTIFICATE",
  "PLEADING",
  "OTHER",
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminDms() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAdminAuth();
  const actorId = user?.userId ?? "";

  const [filters, setFilters] = useState<DmsListFilters>({});
  const filtersKey = useMemo(() => dmsListFiltersKey(filters), [filters]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createType, setCreateType] = useState<DmsDocumentType>("OTHER");
  const [createClientId, setCreateClientId] = useState<string>("");
  const [createProjectId, setCreateProjectId] = useState<string>("");
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createComment, setCreateComment] = useState("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState<DmsDocumentType>("OTHER");
  const [editClientId, setEditClientId] = useState<string>("");
  const [editProjectId, setEditProjectId] = useState<string>("");
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionComment, setNewVersionComment] = useState("");
  const [permUserId, setPermUserId] = useState("");
  const [permLevel, setPermLevel] = useState<"READ" | "WRITE" | "ADMIN">("READ");
  const [reviewRequestNote, setReviewRequestNote] = useState("");
  const [reviewAssigneeIds, setReviewAssigneeIds] = useState<string[]>([]);
  const [reviewAssignMode, setReviewAssignMode] = useState<"manual" | "all" | "site" | "project_team">("manual");
  const [reviewSiteId, setReviewSiteId] = useState("");

  const { data: clients = [] } = useQuery({ queryKey: queryKeys.clients, queryFn: fetchClients });
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjectsWithDocuments,
  });
  const { data: backofficeUsers = [] } = useQuery({
    queryKey: queryKeys.backofficeUsers,
    queryFn: fetchBackofficeUsers,
    enabled: !!detailId,
  });
  const { data: companyWorkers = [] } = useQuery({
    queryKey: queryKeys.companyWorkers,
    queryFn: fetchCompanyWorkers,
    enabled: !!detailId && isAdmin,
  });
  const { data: workSites = [] } = useQuery({
    queryKey: queryKeys.workCalendarSites,
    queryFn: fetchWorkCalendarSites,
    enabled: !!detailId && isAdmin,
  });

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.tradeName || c.companyName || c.id])),
    [clients]
  );
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.title])),
    [projects]
  );
  const userLabelMap = useMemo(
    () =>
      Object.fromEntries(
        backofficeUsers.map((u) => [
          u.id,
          (u.firstName + " " + u.lastName).trim() || u.email || u.id,
        ])
      ),
    [backofficeUsers]
  );

  const listQuery = useQuery({
    queryKey: queryKeys.dmsDocuments(filtersKey),
    queryFn: () => listDmsDocuments(filters),
    enabled: !!actorId,
  });

  const versionsQuery = useQuery({
    queryKey: queryKeys.dmsDocumentVersions(detailId ?? ""),
    queryFn: () => listDmsDocumentVersions(detailId!),
    enabled: !!detailId,
  });

  const permsQuery = useQuery({
    queryKey: queryKeys.dmsDocumentPermissions(detailId ?? ""),
    queryFn: () => listDmsDocumentPermissions(detailId!),
    enabled: !!detailId,
  });

  const logsQuery = useQuery({
    queryKey: queryKeys.dmsDocumentLogs(detailId ?? ""),
    queryFn: () => listDmsDocumentLogs(detailId!),
    enabled: !!detailId,
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.dmsDocumentReviews(detailId ?? ""),
    queryFn: () => listDmsDocumentReviews(detailId!),
    enabled: !!detailId,
  });

  const detailDoc = useMemo(
    () => listQuery.data?.find((d) => d.id === detailId) ?? null,
    [listQuery.data, detailId]
  );

  const openDetail = (id: string, doc?: DmsDocumentRecord) => {
    setDetailId(id);
    const d = doc ?? listQuery.data?.find((x) => x.id === id);
    if (d) {
      setEditName(d.name);
      setEditDesc(d.description);
      setEditType(d.documentType);
      setEditClientId(d.clientId ?? "");
      setEditProjectId(d.projectId ?? "");
    }
    setNewVersionFile(null);
    setNewVersionComment("");
    setPermUserId("");
    setReviewRequestNote("");
    setReviewAssigneeIds([]);
    setReviewAssignMode("manual");
    setReviewSiteId("");
  };

  const resolveReviewAssigneeIds = useCallback((): string[] => {
    const workerUsers = backofficeUsers.filter((u) => u.role === "WORKER" && u.active);
    if (reviewAssignMode === "all") return workerUsers.map((u) => u.id);
    if (reviewAssignMode === "site") {
      if (!reviewSiteId) return [];
      const inSite = new Set(
        companyWorkers.filter((w) => w.active && w.workCalendarSiteId === reviewSiteId).map((w) => w.id)
      );
      return workerUsers.filter((u) => u.companyWorkerId && inSite.has(u.companyWorkerId)).map((u) => u.id);
    }
    if (reviewAssignMode === "project_team") {
      const pid = detailDoc?.projectId;
      if (!pid) return [];
      const proj = projects.find((p) => p.id === pid);
      if (!proj?.members?.length) return [];
      const memberCw = new Set(proj.members.map((m) => m.companyWorkerId));
      return workerUsers.filter((u) => u.companyWorkerId && memberCw.has(u.companyWorkerId)).map((u) => u.id);
    }
    return reviewAssigneeIds;
  }, [
    backofficeUsers,
    companyWorkers,
    detailDoc?.projectId,
    projects,
    reviewAssignMode,
    reviewAssigneeIds,
    reviewSiteId,
  ]);

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: ["dmsDocuments"] });
  };

  const createMut = useMutation({
    mutationFn: async () => {
      if (!actorId || !createFile || !createName.trim()) throw new Error(t("admin.dms.error_missing_file"));
      return createDmsDocumentWithInitialVersion({
        name: createName.trim(),
        description: createDesc,
        documentType: createType,
        clientId: createClientId || null,
        projectId: createProjectId || null,
        file: createFile,
        comment: createComment,
        actorBackofficeUserId: actorId,
      });
    },
    onSuccess: () => {
      toast({ title: t("admin.dms.toast_created") });
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      setCreateType("OTHER");
      setCreateClientId("");
      setCreateProjectId("");
      setCreateFile(null);
      setCreateComment("");
      invalidateList();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const saveMetaMut = useMutation({
    mutationFn: async () => {
      if (!actorId || !detailId) return;
      await updateDmsDocumentMetadata(
        detailId,
        {
          name: editName,
          description: editDesc,
          documentType: editType,
          clientId: editClientId || null,
          projectId: editProjectId || null,
        },
        actorId
      );
    },
    onSuccess: () => {
      toast({ title: t("admin.dms.toast_meta_saved") });
      invalidateList();
      void queryClient.invalidateQueries({ queryKey: queryKeys.dmsDocumentLogs(detailId!) });
      void logsQuery.refetch();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const versionMut = useMutation({
    mutationFn: async () => {
      if (!actorId || !detailId || !newVersionFile) throw new Error(t("admin.dms.error_missing_file"));
      await uploadDmsDocumentVersion({
        documentId: detailId,
        file: newVersionFile,
        comment: newVersionComment,
        actorBackofficeUserId: actorId,
      });
    },
    onSuccess: () => {
      toast({ title: t("admin.dms.toast_version") });
      setNewVersionFile(null);
      setNewVersionComment("");
      void versionsQuery.refetch();
      invalidateList();
      void queryClient.invalidateQueries({ queryKey: queryKeys.dmsDocumentLogs(detailId!) });
      void logsQuery.refetch();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!actorId || !detailId) return;
      if (!window.confirm(t("admin.dms.confirm_delete"))) {
        throw new Error("cancelled");
      }
      await deleteDmsDocument({ documentId: detailId, actorBackofficeUserId: actorId });
    },
    onSuccess: () => {
      toast({ title: t("admin.dms.toast_deleted") });
      setDetailId(null);
      invalidateList();
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "cancelled") return;
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const setPermMut = useMutation({
    mutationFn: async () => {
      if (!actorId || !detailId || !permUserId) return;
      await setDmsDocumentPermission({
        documentId: detailId,
        backofficeUserId: permUserId,
        permission: permLevel,
        actorBackofficeUserId: actorId,
      });
    },
    onSuccess: () => {
      toast({ title: t("admin.dms.toast_perm") });
      void permsQuery.refetch();
      void logsQuery.refetch();
      setPermUserId("");
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const removePermMut = useMutation({
    mutationFn: async (targetId: string) => {
      if (!actorId || !detailId) return;
      await removeDmsDocumentPermission({
        documentId: detailId,
        backofficeUserId: targetId,
        actorBackofficeUserId: actorId,
      });
    },
    onSuccess: () => {
      toast({ title: t("admin.dms.toast_perm_revoke") });
      void permsQuery.refetch();
      void logsQuery.refetch();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const assignReviewMut = useMutation({
    mutationFn: async () => {
      if (!actorId || !detailId) return;
      const ids = resolveReviewAssigneeIds();
      if (ids.length === 0) {
        throw new Error(t("admin.dms.review_assign_no_targets"));
      }
      await assignDmsDocumentReview({
        documentId: detailId,
        assigneeBackofficeUserIds: ids,
        requestNote: reviewRequestNote,
        actorBackofficeUserId: actorId,
      });
    },
    onSuccess: () => {
      toast({ title: t("admin.dms.toast_review_assigned") });
      setReviewAssigneeIds([]);
      setReviewRequestNote("");
      setReviewAssignMode("manual");
      setReviewSiteId("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myDmsDocumentReviews });
      void reviewsQuery.refetch();
      void logsQuery.refetch();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const resolveReviewMut = useMutation({
    mutationFn: async (payload: { reviewId: string; status: "APPROVED" | "CHANGES_REQUESTED"; reason?: string }) => {
      if (!actorId) return;
      await resolveDmsDocumentReview({
        reviewId: payload.reviewId,
        status: payload.status,
        rejectionReason: payload.reason,
        actorBackofficeUserId: actorId,
      });
    },
    onSuccess: (_, vars) => {
      toast({
        title:
          vars.status === "APPROVED" ? t("admin.dms.toast_review_approved") : t("admin.dms.toast_review_changes"),
      });
      void reviewsQuery.refetch();
      void logsQuery.refetch();
    },
    onError: (e) => {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    },
  });

  const toggleReviewAssignee = (id: string) => {
    setReviewAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const reviewStatusLabel = (status: DmsReviewStatus) => {
    if (status === "ASSIGNED") return t("admin.dms.review_status_ASSIGNED");
    if (status === "SUBMITTED") return t("admin.dms.review_status_SUBMITTED");
    if (status === "APPROVED") return t("admin.dms.review_status_APPROVED");
    return t("admin.dms.review_status_CHANGES_REQUESTED");
  };

  const downloadVersion = async (versionId: string) => {
    if (!actorId || !detailId) return;
    try {
      const url = await getDmsVersionSignedUrl(versionId, {
        logDownload: true,
        actorBackofficeUserId: actorId,
        documentId: detailId,
      });
      window.open(url, "_blank", "noopener,noreferrer");
      void logsQuery.refetch();
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.dms.error_generic"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border bg-muted/40 p-2">
            <Archive className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("admin.dms.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("admin.dms.subtitle")}</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!actorId}>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin.dms.new_document")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("admin.dms.filters_title")}</CardTitle>
          <CardDescription>{t("admin.dms.filters_hint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <Label>{t("admin.dms.search")}</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={t("admin.dms.search_ph")}
                value={filters.search ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
          </div>
          <div className="w-full md:w-44 space-y-1.5">
            <Label>{t("admin.dms.type")}</Label>
            <SearchableSelect
              value={filters.documentType ? filters.documentType : "__all__"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, documentType: v === "__all__" ? "" : (v as DmsDocumentType) }))
              }
              options={[
                { value: "__all__", label: t("admin.dms.all") },
                ...DOCUMENT_TYPES.map((dt) => ({
                  value: dt,
                  label: t(`admin.dms.doc_type_${dt}`),
                })),
              ]}
              placeholder={t("admin.dms.all")}
            />
          </div>
          <div className="w-full md:w-48 space-y-1.5">
            <Label>{t("admin.dms.client")}</Label>
            <SearchableSelect
              value={filters.clientId ?? "__all__"}
              onValueChange={(v) => setFilters((f) => ({ ...f, clientId: v === "__all__" ? undefined : v }))}
              options={[
                { value: "__all__", label: t("admin.dms.all") },
                ...clients.map((c) => ({
                  value: c.id,
                  label: c.tradeName || c.companyName,
                })),
              ]}
              placeholder={t("admin.dms.all")}
            />
          </div>
          <div className="w-full md:w-48 space-y-1.5">
            <Label>{t("admin.dms.project")}</Label>
            <SearchableSelect
              value={filters.projectId ?? "__all__"}
              onValueChange={(v) => setFilters((f) => ({ ...f, projectId: v === "__all__" ? undefined : v }))}
              options={[
                { value: "__all__", label: t("admin.dms.all") },
                ...projects.map((p) => ({
                  value: p.id,
                  label: p.title,
                })),
              ]}
              placeholder={t("admin.dms.all")}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void listQuery.refetch()}
            aria-label={t("admin.dms.refresh")}
          >
            <RefreshCw className={`h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("admin.dms.list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.dms.loading")}
            </p>
          ) : listQuery.isError ? (
            <p className="text-sm text-destructive">{t("admin.dms.load_error")}</p>
          ) : !listQuery.data?.length ? (
            <p className="text-sm text-muted-foreground">{t("admin.dms.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.dms.col_name")}</TableHead>
                  <TableHead>{t("admin.dms.col_type")}</TableHead>
                  <TableHead>{t("admin.dms.col_client")}</TableHead>
                  <TableHead>{t("admin.dms.col_project")}</TableHead>
                  <TableHead className="text-right">{t("admin.dms.col_versions")}</TableHead>
                  <TableHead>{t("admin.dms.col_updated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(row.id, row)}
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{t(`admin.dms.doc_type_${row.documentType}`)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.clientId ? clientMap[row.clientId] ?? "—" : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.projectId ? projectMap[row.projectId] ?? "—" : "―"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.versionCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.updatedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin.dms.dialog_create_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t("admin.dms.field_name")}</Label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.dms.field_description")}</Label>
              <Textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.dms.type")}</Label>
              <SearchableSelect
                value={createType}
                onValueChange={(v) => setCreateType(v as DmsDocumentType)}
                options={DOCUMENT_TYPES.map((dt) => ({
                  value: dt,
                  label: t(`admin.dms.doc_type_${dt}`),
                }))}
                searchable={false}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("admin.dms.client")}</Label>
                <SearchableSelect
                  value={createClientId || "__none__"}
                  onValueChange={(v) => setCreateClientId(v === "__none__" ? "" : v)}
                  options={[
                    { value: "__none__", label: "—" },
                    ...clients.map((c) => ({
                      value: c.id,
                      label: c.tradeName || c.companyName,
                    })),
                  ]}
                  placeholder="—"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.dms.project")}</Label>
                <SearchableSelect
                  value={createProjectId || "__none__"}
                  onValueChange={(v) => setCreateProjectId(v === "__none__" ? "" : v)}
                  options={[
                    { value: "__none__", label: "—" },
                    ...projects.map((p) => ({
                      value: p.id,
                      label: p.title,
                    })),
                  ]}
                  placeholder="—"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.dms.field_file")}</Label>
              <Input type="file" onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.dms.version_comment")}</Label>
              <Input value={createComment} onChange={(e) => setCreateComment(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("admin.common.cancel")}
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.dms.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detailDoc?.name ?? t("admin.dms.detail_title")}</SheetTitle>
            <SheetDescription>{t("admin.dms.detail_subtitle")}</SheetDescription>
          </SheetHeader>
          {detailDoc && (
            <div className="mt-6 space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t("admin.dms.section_meta")}</h3>
                <div className="space-y-2">
                  <Label>{t("admin.dms.field_name")}</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.dms.field_description")}</Label>
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.dms.type")}</Label>
                  <SearchableSelect
                    value={editType}
                    onValueChange={(v) => setEditType(v as DmsDocumentType)}
                    options={DOCUMENT_TYPES.map((dt) => ({
                      value: dt,
                      label: t(`admin.dms.doc_type_${dt}`),
                    }))}
                    searchable={false}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-2">
                    <Label>{t("admin.dms.client")}</Label>
                    <SearchableSelect
                      value={editClientId || "__none__"}
                      onValueChange={(v) => setEditClientId(v === "__none__" ? "" : v)}
                      options={[
                        { value: "__none__", label: "—" },
                        ...clients.map((c) => ({
                          value: c.id,
                          label: c.tradeName || c.companyName,
                        })),
                      ]}
                      placeholder="—"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("admin.dms.project")}</Label>
                    <SearchableSelect
                      value={editProjectId || "__none__"}
                      onValueChange={(v) => setEditProjectId(v === "__none__" ? "" : v)}
                      options={[
                        { value: "__none__", label: "—" },
                        ...projects.map((p) => ({
                          value: p.id,
                          label: p.title,
                        })),
                      ]}
                      placeholder="—"
                    />
                  </div>
                </div>
                <Button size="sm" onClick={() => saveMetaMut.mutate()} disabled={saveMetaMut.isPending}>
                  {saveMetaMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.dms.save_meta")}
                </Button>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t("admin.dms.section_versions")}</h3>
                {versionsQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {(versionsQuery.data ?? []).map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                        <div className="min-w-0">
                          <span className="font-medium">v{v.versionNumber}</span>
                          <span className="text-muted-foreground ml-2 truncate">{v.originalFilename}</span>
                          <div className="text-xs text-muted-foreground">
                            {formatBytes(v.fileSize)} · {new Date(v.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Button type="button" size="icon" variant="ghost" onClick={() => void downloadVersion(v.id)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                  <Label className="flex items-center gap-2">
                    <FileUp className="h-4 w-4" /> {t("admin.dms.new_version")}
                  </Label>
                  <Input type="file" onChange={(e) => setNewVersionFile(e.target.files?.[0] ?? null)} />
                  <Input
                    placeholder={t("admin.dms.version_comment")}
                    value={newVersionComment}
                    onChange={(e) => setNewVersionComment(e.target.value)}
                  />
                  <Button size="sm" onClick={() => versionMut.mutate()} disabled={versionMut.isPending}>
                    {versionMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.dms.upload_version")}
                  </Button>
                </div>
              </div>

              {isAdmin && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("admin.dms.section_perms")}</h3>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1">
                      <Label>{t("admin.dms.perm_user")}</Label>
                      <SearchableSelect
                        value={permUserId || "__none__"}
                        onValueChange={(v) => setPermUserId(v === "__none__" ? "" : v)}
                        options={[
                          { value: "__none__", label: t("admin.dms.perm_user_ph") },
                          ...backofficeUsers
                            .filter((u) => u.id !== detailDoc.createdByBackofficeUserId)
                            .map((u) => ({
                              value: u.id,
                              label: (u.firstName + " " + u.lastName).trim() || u.email,
                            })),
                        ]}
                        placeholder={t("admin.dms.perm_user_ph")}
                      />
                    </div>
                    <div className="w-full sm:w-32 space-y-1">
                      <Label>{t("admin.dms.perm_level")}</Label>
                      <SearchableSelect
                        value={permLevel}
                        onValueChange={(v) => setPermLevel(v as "READ" | "WRITE" | "ADMIN")}
                        options={[
                          { value: "READ", label: t("admin.dms.perm_read") },
                          { value: "WRITE", label: t("admin.dms.perm_write") },
                          { value: "ADMIN", label: t("admin.dms.perm_admin") },
                        ]}
                        searchable={false}
                        className="h-10"
                      />
                    </div>
                    <Button type="button" size="sm" onClick={() => setPermMut.mutate()} disabled={!permUserId || setPermMut.isPending}>
                      {t("admin.dms.perm_add")}
                    </Button>
                  </div>
                  <ul className="text-sm space-y-1">
                    {(permsQuery.data ?? []).map((p) => (
                      <li key={p.id} className="flex justify-between items-center border rounded px-2 py-1">
                        <span>
                          {backofficeUsers.find((u) => u.id === p.backofficeUserId)?.email ?? p.backofficeUserId}{" "}
                          <span className="text-muted-foreground">({p.permission})</span>
                        </span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removePermMut.mutate(p.backofficeUserId)}>
                          {t("admin.dms.perm_remove")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t("admin.dms.section_review_flow")}</h3>

                {isAdmin && (
                  <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                    <Label>{t("admin.dms.review_assign_workers")}</Label>
                    <SearchableSelect
                      value={reviewAssignMode}
                      onValueChange={(v) =>
                        setReviewAssignMode(v as "manual" | "all" | "site" | "project_team")
                      }
                      options={[
                        { value: "manual", label: t("admin.dms.review_mode_manual") },
                        { value: "all", label: t("admin.dms.review_mode_all") },
                        { value: "site", label: t("admin.dms.review_mode_site") },
                        { value: "project_team", label: t("admin.dms.review_mode_team") },
                      ]}
                      searchable={false}
                    />

                    {reviewAssignMode === "site" ? (
                      <div className="space-y-1">
                        <Label className="text-xs">{t("admin.dms.review_site_label")}</Label>
                        <SearchableSelect
                          value={reviewSiteId || "__none__"}
                          onValueChange={(v) => setReviewSiteId(v === "__none__" ? "" : v)}
                          options={[
                            { value: "__none__", label: t("admin.dms.review_site_ph") },
                            ...workSites.map((s) => ({ value: s.id, label: s.name })),
                          ]}
                          placeholder={t("admin.dms.review_site_ph")}
                        />
                      </div>
                    ) : null}

                    {reviewAssignMode === "project_team" ? (
                      <p className="text-xs text-muted-foreground">
                        {detailDoc?.projectId
                          ? `${t("admin.dms.review_team_hint_ok_prefix")} «${projectMap[detailDoc.projectId] ?? detailDoc.projectId}».`
                          : t("admin.dms.review_team_hint_no_project")}
                      </p>
                    ) : null}

                    {reviewAssignMode === "manual" ? (
                      <div className="max-h-40 overflow-y-auto space-y-1 rounded border p-2 bg-background">
                        {backofficeUsers
                          .filter((u) => u.role === "WORKER" && u.active)
                          .map((u) => {
                            const label = (u.firstName + " " + u.lastName).trim() || u.email || u.id;
                            const checked = reviewAssigneeIds.includes(u.id);
                            return (
                              <label key={u.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleReviewAssignee(u.id)}
                                />
                                <span>{label}</span>
                              </label>
                            );
                          })}
                      </div>
                    ) : null}

                    <Textarea
                      rows={2}
                      placeholder={t("admin.dms.review_assign_note_ph")}
                      value={reviewRequestNote}
                      onChange={(e) => setReviewRequestNote(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => assignReviewMut.mutate()}
                        disabled={resolveReviewAssigneeIds().length === 0 || assignReviewMut.isPending}
                      >
                        {t("admin.dms.review_assign_submit")}
                        {resolveReviewAssigneeIds().length > 0
                          ? ` (${resolveReviewAssigneeIds().length})`
                          : ""}
                      </Button>
                      <span className="text-xs text-muted-foreground">{t("admin.dms.review_assign_message_hint")}</span>
                    </div>
                  </div>
                )}

                {reviewsQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : !(reviewsQuery.data ?? []).length ? (
                  <p className="text-sm text-muted-foreground">{t("admin.dms.review_empty")}</p>
                ) : (
                  <ul className="space-y-2">
                    {(reviewsQuery.data ?? []).map((r) => {
                      const isAssignee = r.assigneeBackofficeUserId === actorId;
                      const canSubmit = isAssignee && (r.status === "ASSIGNED" || r.status === "CHANGES_REQUESTED");
                      const canApprove = isAdmin && r.status === "SUBMITTED";
                      return (
                        <li key={r.id} className="rounded-md border p-2 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">
                              {userLabelMap[r.assigneeBackofficeUserId] ?? r.assigneeBackofficeUserId}
                            </span>
                            <span className="text-muted-foreground">- {reviewStatusLabel(r.status)}</span>
                          </div>
                          {r.requestNote ? <p className="text-xs text-muted-foreground">{r.requestNote}</p> : null}
                          {r.workerNote ? <p className="text-xs">{r.workerNote}</p> : null}
                          {r.rejectionReason ? (
                            <p className="text-xs text-destructive">{r.rejectionReason}</p>
                          ) : null}

                          {!canSubmit ? (
                            <p className="text-xs text-muted-foreground">
                              {t("admin.dms.task_read")}: {r.taskReadAt ? "✓" : "—"} · {t("admin.dms.task_review")}:{" "}
                              {r.taskReviewAt ? "✓" : "—"}
                              {r.workerOutcome
                                ? ` · ${
                                    r.workerOutcome === "OK"
                                      ? t("admin.dms.worker_outcome_ok")
                                      : t("admin.dms.worker_outcome_not_ok")
                                  }`
                                : ""}
                            </p>
                          ) : null}

                          {canSubmit ? (
                            <DmsWorkerReviewPanel
                              reviewId={r.id}
                              initialReview={r}
                              onUpdated={() => {
                                void reviewsQuery.refetch();
                                void listQuery.refetch();
                                void versionsQuery.refetch();
                                void logsQuery.refetch();
                              }}
                            />
                          ) : null}

                          {canApprove ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() =>
                                  resolveReviewMut.mutate({
                                    reviewId: r.id,
                                    status: "APPROVED",
                                  })
                                }
                                disabled={resolveReviewMut.isPending}
                              >
                                {t("admin.dms.review_approve")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const reason = window.prompt(t("admin.dms.review_changes_reason_prompt"));
                                  if (reason === null) return;
                                  resolveReviewMut.mutate({
                                    reviewId: r.id,
                                    status: "CHANGES_REQUESTED",
                                    reason,
                                  });
                                }}
                                disabled={resolveReviewMut.isPending}
                              >
                                {t("admin.dms.review_request_changes")}
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t("admin.dms.section_logs")}</h3>
                <div className="max-h-48 overflow-y-auto text-xs space-y-2 border rounded-md p-2">
                  {(logsQuery.data ?? []).map((log) => (
                    <div key={log.id} className="border-b border-border/50 pb-1 last:border-0">
                      <span className="font-medium">{log.action}</span>
                      <span className="text-muted-foreground ml-2">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t("admin.dms.delete_document")}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default AdminDms;

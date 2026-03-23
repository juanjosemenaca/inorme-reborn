import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { sortRows, toggleColumnSort, type ColumnSort } from "@/lib/adminListUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useCompanyWorkers } from "@/hooks/useCompanyWorkers";
import {
  createProject,
  deleteProject,
  deleteProjectDocument,
  syncProjectMembers,
  updateProject,
  uploadProjectDocument,
} from "@/api/projectsApi";
import type { ProjectMemberInput } from "@/api/projectsApi";
import { PROJECT_MEMBER_ROLES, type ProjectMemberRole } from "@/types/projects";
import { queryKeys } from "@/lib/queryKeys";
import type { ProjectWithDocuments } from "@/types/projects";
import { ProjectFormDialog, type ProjectFormValues } from "@/components/admin/ProjectFormDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorMessage";

const AdminProjects = () => {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading, isError, error } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: workers = [] } = useCompanyWorkers();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ColumnSort | null>({ key: "title", dir: "asc" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithDocuments | null>(null);

  const editing = useMemo(() => {
    if (!editingId) return null;
    return projects.find((p) => p.id === editingId) ?? null;
  }, [projects, editingId]);

  useEffect(() => {
    if (editingId && !projects.some((p) => p.id === editingId)) {
      setEditingId(null);
      setDialogOpen(false);
    }
  }, [editingId, projects]);

  const clientLabel = useCallback(
    (id: string) => {
      const c = clients.find((x) => x.id === id);
      return c ? c.tradeName : "—";
    },
    [clients]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const hay = [
        p.title,
        p.description,
        clientLabel(p.clientId),
        p.finalClientId ? clientLabel(p.finalClientId) : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query, clientLabel]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const getters: Record<string, (p: ProjectWithDocuments) => string | number> = {
      title: (p) => p.title,
      client: (p) => clientLabel(p.clientId),
      finalClient: (p) => (p.finalClientId ? clientLabel(p.finalClientId) : ""),
      startDate: (p) => p.startDate ?? "",
      endDate: (p) => p.endDate ?? "",
      docs: (p) => p.documents.length,
      team: (p) => p.members.length,
    };
    const get = getters[sort.key];
    if (!get) return filtered;
    return sortRows(filtered, sort.dir, get);
  }, [filtered, sort, clientLabel]);

  const handleSort = (key: string) => {
    setSort((s) => toggleColumnSort(s, key));
  };

  const openCreate = () => {
    setDialogMode("create");
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (p: ProjectWithDocuments) => {
    setDialogMode("edit");
    setEditingId(p.id);
    setDialogOpen(true);
  };

  const toSaveInput = (values: ProjectFormValues) => {
    const client = clients.find((c) => c.id === values.clientId);
    const finalRaw =
      client?.clientKind === "INTERMEDIARIO" ? values.finalClientId?.trim() || null : null;
    return {
      title: values.title,
      description: values.description ?? "",
      clientId: values.clientId,
      finalClientId: finalRaw,
      startDate: values.startDate?.trim() ? values.startDate : null,
      endDate: values.endDate?.trim() ? values.endDate : null,
    };
  };

  const roleLabels = useMemo(() => {
    const r: Record<ProjectMemberRole, string> = {} as Record<ProjectMemberRole, string>;
    for (const role of PROJECT_MEMBER_ROLES) {
      r[role] = t(`admin.projects.role_${role}`);
    }
    return r;
  }, [t]);

  const handleFormSubmit = async (values: ProjectFormValues, pendingFiles: File[], members: ProjectMemberInput[]) => {
    try {
      if (dialogMode === "create") {
        const created = await createProject(toSaveInput(values), clients);
        await syncProjectMembers(created.id, members);
        for (const file of pendingFiles) {
          await uploadProjectDocument(created.id, file);
        }
        toast({ title: t("admin.projects.toast_created") });
      } else if (editingId) {
        await updateProject(editingId, toSaveInput(values), clients);
        await syncProjectMembers(editingId, members);
        for (const file of pendingFiles) {
          await uploadProjectDocument(editingId, file);
        }
        toast({ title: t("admin.projects.toast_updated") });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.projects.toast_save_error"),
        variant: "destructive",
      });
      throw e;
    }
  };

  const handleDeleteDocument = async (doc: Parameters<typeof deleteProjectDocument>[0]) => {
    try {
      await deleteProjectDocument(doc);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      toast({ title: t("admin.projects.toast_doc_deleted") });
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.projects.toast_doc_delete_error"),
        variant: "destructive",
      });
      throw e;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      toast({ title: t("admin.projects.toast_deleted") });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: t("admin.common.error"),
        description: e instanceof Error ? e.message : t("admin.projects.toast_delete_error"),
        variant: "destructive",
      });
    }
  };

  const dateLocale = language === "ca" ? "ca-ES" : language === "en" ? "en-GB" : "es-ES";

  const formatDate = (iso: string | null) => {
    if (!iso) return t("admin.common.none");
    try {
      const d = new Date(iso + "T12:00:00");
      return d.toLocaleDateString(dateLocale);
    } catch {
      return iso;
    }
  };

  const formLabels = {
    titleCreate: t("admin.projects.dialog_title_create"),
    titleEdit: t("admin.projects.dialog_title_edit"),
    description: t("admin.projects.dialog_desc"),
    fieldTitle: t("admin.projects.field_title"),
    fieldDescription: t("admin.projects.field_description"),
    client: t("admin.projects.field_client"),
    clientPlaceholder: t("admin.projects.client_placeholder"),
    finalClient: t("admin.projects.field_final_client"),
    finalClientHint: t("admin.projects.field_final_hint"),
    finalNone: t("admin.projects.final_none"),
    startDate: t("admin.projects.field_start"),
    endDate: t("admin.projects.field_end"),
    teamSection: t("admin.projects.team_section"),
    teamHint: t("admin.projects.team_hint"),
    addMember: t("admin.projects.add_member"),
    memberWorker: t("admin.projects.member_worker"),
    memberRole: t("admin.projects.member_role"),
    memberPlaceholder: t("admin.projects.member_placeholder"),
    removeMember: t("admin.projects.remove_member"),
    docsSection: t("admin.projects.docs_section"),
    docsHint: t("admin.projects.docs_hint"),
    addFiles: t("admin.projects.add_files"),
    removePending: t("admin.projects.remove_pending"),
    download: t("admin.projects.download"),
    deleteDoc: t("admin.projects.delete_doc"),
    deleteDocTitle: t("admin.projects.delete_doc_title"),
    deleteDocDesc: t("admin.projects.delete_doc_desc"),
    saving: t("admin.projects.saving"),
    save: t("admin.common.save"),
    cancel: t("admin.common.cancel"),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("admin.common.loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
        <p className="font-medium text-destructive">{t("admin.projects.load_error")}</p>
        <p className="text-muted-foreground break-words whitespace-pre-wrap">{getErrorMessage(error)}</p>
        <p className="text-xs text-muted-foreground">{t("admin.projects.load_error_hint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-7 w-7 text-primary" />
            {t("admin.projects.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t("admin.projects.subtitle")}</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("admin.projects.new")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("admin.projects.list")}</CardTitle>
              <CardDescription>
                {t("admin.common.showing")} {sorted.length} {t("admin.common.of")} {projects.length}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.projects.search_ph")}
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <div className="px-6 pb-6 overflow-x-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {query.trim() ? t("admin.projects.empty_filter") : t("admin.projects.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    label={t("admin.projects.col_title")}
                    columnKey="title"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.projects.col_client")}
                    columnKey="client"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.projects.col_final_client")}
                    columnKey="finalClient"
                    currentSort={sort}
                    onSort={handleSort}
                    className="min-w-[120px]"
                  />
                  <SortableTableHead
                    label={t("admin.projects.col_start")}
                    columnKey="startDate"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.projects.col_end")}
                    columnKey="endDate"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.projects.col_team")}
                    columnKey="team"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <SortableTableHead
                    label={t("admin.projects.col_docs")}
                    columnKey="docs"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right w-[120px]">{t("admin.common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p) => {
                  const cl = clients.find((c) => c.id === p.clientId);
                  const showFinal = cl?.clientKind === "INTERMEDIARIO";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium max-w-[220px]">
                        <div className="truncate" title={p.title}>
                          {p.title}
                        </div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{clientLabel(p.clientId)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {showFinal
                          ? p.finalClientId
                            ? clientLabel(p.finalClientId)
                            : t("admin.clients.final_not_set")
                          : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{formatDate(p.startDate)}</TableCell>
                      <TableCell className="tabular-nums text-sm">{formatDate(p.endDate)}</TableCell>
                      <TableCell className="tabular-nums text-sm">{p.members.length}</TableCell>
                      <TableCell className="tabular-nums text-sm">{p.documents.length}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(p)}
                          aria-label={t("admin.common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(p)}
                          aria-label={t("admin.common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingId(null);
        }}
        mode={dialogMode}
        initial={editing}
        clients={clients}
        workers={workers}
        roleLabels={roleLabels}
        labels={formLabels}
        onSubmit={handleFormSubmit}
        onDeleteDocument={handleDeleteDocument}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.projects.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.projects.delete_desc")} <strong>{deleteTarget?.title}</strong>{" "}
              {t("admin.projects.delete_desc_suffix")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProjects;

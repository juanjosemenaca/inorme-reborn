import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Download, FileUp, Loader2, Trash2, UserPlus } from "lucide-react";
import type { ClientRecord } from "@/types/clients";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";
import {
  PROJECT_MEMBER_ROLES,
  type ProjectDocumentRecord,
  type ProjectMemberRole,
  type ProjectWithDocuments,
} from "@/types/projects";
import { getProjectDocumentSignedUrl, type ProjectMemberInput } from "@/api/projectsApi";
import { defaultProjectEndNoticeAtIso } from "@/lib/defaultProjectEndNoticeAt";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

const NONE_VALUE = "__none__";

const schema = z
  .object({
    title: z.string().min(1, "Obligatorio"),
    description: z.string().optional(),
    clientId: z.string().min(1, "Elige un cliente"),
    finalClientId: z.string().optional(),
    startDate: z.string().min(1, "Indica la fecha de inicio"),
    endDate: z.string().min(1, "Indica la fecha de fin planificada"),
    responsibleWorkerId: z.string().min(1, "Indica el responsable del proyecto"),
    endNoticeAt: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.startDate?.trim() || !data.endDate?.trim()) return true;
      return data.endDate >= data.startDate;
    },
    { message: "La fecha de fin debe ser posterior o igual al inicio", path: ["endDate"] }
  )
  .refine(
    (data) => {
      const n = data.endNoticeAt?.trim();
      if (!n) return true;
      return n <= data.endDate;
    },
    { message: "La fecha de aviso no puede ser posterior a la fecha de fin.", path: ["endNoticeAt"] }
  );

export type ProjectFormValues = z.infer<typeof schema>;

type MemberRow = { rowKey: string; companyWorkerId: string; role: ProjectMemberRole };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial: ProjectWithDocuments | null;
  clients: ClientRecord[];
  /** Fichas de plantilla (activas) para asignar al proyecto. */
  workers: CompanyWorkerRecord[];
  /** Etiqueta por rol (i18n). */
  roleLabels: Record<ProjectMemberRole, string>;
  labels: {
    titleCreate: string;
    titleEdit: string;
    description: string;
    fieldTitle: string;
    fieldDescription: string;
    client: string;
    clientPlaceholder: string;
    finalClient: string;
    finalClientHint: string;
    finalNone: string;
    startDate: string;
    endDate: string;
    responsible: string;
    responsiblePlaceholder: string;
    responsibleShortHint: string;
    endNotice: string;
    endNoticeHint: string;
    endNoticeDefaultLine: string;
    docsSection: string;
    docsHint: string;
    teamSection: string;
    teamHint: string;
    addMember: string;
    memberWorker: string;
    memberRole: string;
    memberPlaceholder: string;
    removeMember: string;
    addFiles: string;
    removePending: string;
    download: string;
    deleteDoc: string;
    deleteDocTitle: string;
    deleteDocDesc: string;
    saving: string;
    save: string;
    cancel: string;
  };
  onSubmit: (values: ProjectFormValues, pendingFiles: File[], members: ProjectMemberInput[]) => Promise<void>;
  onDeleteDocument?: (doc: ProjectDocumentRecord) => Promise<void>;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function workerDisplayName(w: CompanyWorkerRecord): string {
  return `${w.firstName} ${w.lastName}`.trim() || w.dni || w.email || "—";
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  clients,
  workers,
  roleLabels,
  labels,
  onSubmit,
  onDeleteDocument,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<ProjectDocumentRecord | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      clientId: "",
      finalClientId: "",
      startDate: "",
      endDate: "",
      responsibleWorkerId: "",
      endNoticeAt: "",
    },
  });

  const clientId = useWatch({ control: form.control, name: "clientId" });
  const endDateW = useWatch({ control: form.control, name: "endDate" });
  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  const finalClientOptions = useMemo(() => {
    return clients.filter((c) => c.clientKind === "FINAL");
  }, [clients]);

  const computedDefaultNotice = useMemo(() => {
    const d = endDateW?.trim() ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    return defaultProjectEndNoticeAtIso(d);
  }, [endDateW]);

  useEffect(() => {
    if (selectedClient?.clientKind === "FINAL") {
      form.setValue("finalClientId", "");
    }
  }, [selectedClient?.clientKind, form]);

  useEffect(() => {
    if (!open) {
      setPendingFiles([]);
      setMemberRows([]);
      return;
    }
    if (mode === "edit" && initial) {
      setMemberRows(
        (initial.members ?? []).map((m) => ({
          rowKey: m.id,
          companyWorkerId: m.companyWorkerId,
          role: m.role,
        }))
      );
      form.reset({
        title: initial.title,
        description: initial.description,
        clientId: initial.clientId,
        finalClientId: initial.finalClientId ?? "",
        startDate: initial.startDate ?? "",
        endDate: initial.endDate ?? "",
        responsibleWorkerId: initial.responsibleCompanyWorkerId ?? "",
        endNoticeAt: initial.endNoticeAt ?? "",
      });
    } else if (mode === "create") {
      setMemberRows([]);
      form.reset({
        title: "",
        description: "",
        clientId: "",
        finalClientId: "",
        startDate: "",
        endDate: "",
        responsibleWorkerId: "",
        endNoticeAt: "",
      });
    }
  }, [open, mode, initial, form]);

  const activeWorkers = useMemo(() => workers.filter((w) => w.active), [workers]);

  const responsibleWorkerOptions = useMemo(() => {
    const keepId = mode === "edit" && initial?.responsibleCompanyWorkerId ? initial.responsibleCompanyWorkerId : null;
    return workers.filter((w) => w.active || (keepId && w.id === keepId));
  }, [workers, mode, initial?.responsibleCompanyWorkerId]);

  const takenWorkerIds = (exceptRowKey: string) =>
    new Set(
      memberRows.filter((r) => r.rowKey !== exceptRowKey && r.companyWorkerId.trim()).map((r) => r.companyWorkerId)
    );

  const selectWorkersForRow = (rowKey: string, selectedId: string) => {
    const taken = takenWorkerIds(rowKey);
    let list = activeWorkers.filter((w) => !taken.has(w.id));
    if (selectedId.trim() && !list.some((w) => w.id === selectedId)) {
      const w = workers.find((x) => x.id === selectedId);
      if (w) list = [w, ...list];
    }
    return list;
  };

  const addMemberRow = () => {
    setMemberRows((prev) => [
      ...prev,
      { rowKey: crypto.randomUUID(), companyWorkerId: "", role: "PROGRAMADOR" },
    ]);
  };

  const removeMemberRow = (rowKey: string) => {
    setMemberRows((prev) => prev.filter((r) => r.rowKey !== rowKey));
  };

  const updateMemberRow = (rowKey: string, patch: Partial<Pick<MemberRow, "companyWorkerId" | "role">>) => {
    setMemberRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    setPendingFiles((prev) => [...prev, ...Array.from(list)]);
    e.target.value = "";
  };

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownload = async (doc: ProjectDocumentRecord) => {
    try {
      setDownloadingId(doc.id);
      const url = await getProjectDocumentSignedUrl(doc.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDeleteDoc = async () => {
    if (!docToDelete || !onDeleteDocument) return;
    try {
      setDeletingDoc(true);
      await onDeleteDocument(docToDelete);
      setDocToDelete(null);
    } finally {
      setDeletingDoc(false);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const normalized: ProjectFormValues = {
        ...values,
        finalClientId:
          selectedClient?.clientKind === "INTERMEDIARIO" && values.finalClientId?.trim()
            ? values.finalClientId
            : "",
        startDate: values.startDate?.trim() || "",
        endDate: values.endDate?.trim() || "",
        responsibleWorkerId: values.responsibleWorkerId?.trim() || "",
        endNoticeAt: values.endNoticeAt?.trim() || "",
      };
      const memberInputs: ProjectMemberInput[] = memberRows
        .filter((r) => r.companyWorkerId.trim())
        .map((r) => ({ companyWorkerId: r.companyWorkerId, role: r.role }));
      await onSubmit(normalized, pendingFiles, memberInputs);
      setPendingFiles([]);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  });

  const showFinal = selectedClient?.clientKind === "INTERMEDIARIO";
  const existingDocs = mode === "edit" && initial ? initial.documents : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? labels.titleCreate : labels.titleEdit}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{labels.fieldTitle}</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{labels.fieldDescription}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} className="resize-y min-h-[100px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{labels.client}</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                      value={field.value?.trim() ? field.value : NONE_VALUE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={labels.clientPlaceholder} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>{labels.clientPlaceholder}</SelectItem>
                        {clients
                          .filter((c) => c.active)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.tradeName} — {c.companyName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showFinal && (
                <FormField
                  control={form.control}
                  name="finalClientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{labels.finalClient}</FormLabel>
                      <p className="text-xs text-muted-foreground">{labels.finalClientHint}</p>
                      <Select
                        onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                        value={field.value?.trim() ? field.value : NONE_VALUE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={labels.finalNone} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>{labels.finalNone}</SelectItem>
                          {finalClientOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id} disabled={c.id === clientId}>
                              {c.tradeName} — {c.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{labels.startDate}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{labels.endDate}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="responsibleWorkerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{labels.responsible}</FormLabel>
                    <p className="text-xs text-muted-foreground -mt-0.5 mb-1">{labels.responsibleShortHint}</p>
                    <Select
                      onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                      value={field.value?.trim() ? field.value : NONE_VALUE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={labels.responsiblePlaceholder} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>{labels.responsiblePlaceholder}</SelectItem>
                        {responsibleWorkerOptions.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {workerDisplayName(w)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endNoticeAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{labels.endNotice}</FormLabel>
                    <p className="text-xs text-muted-foreground -mt-0.5 mb-1">{labels.endNoticeHint}</p>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    {computedDefaultNotice && (
                      <p className="text-xs text-muted-foreground">
                        {labels.endNoticeDefaultLine}{" "}
                        <span className="font-medium tabular-nums">
                          {new Date(computedDefaultNotice + "T12:00:00").toLocaleDateString()}
                        </span>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <p className="text-sm font-medium">{labels.teamSection}</p>
                <p className="text-xs text-muted-foreground">{labels.teamHint}</p>
                {memberRows.length > 0 && (
                  <ul className="space-y-2">
                    {memberRows.map((row) => {
                      const selectWorkers = selectWorkersForRow(row.rowKey, row.companyWorkerId);
                      return (
                        <li
                          key={row.rowKey}
                          className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2 rounded-md border bg-background p-2"
                        >
                          <div className="flex-1 space-y-1 min-w-0">
                            <label className="text-xs text-muted-foreground">{labels.memberWorker}</label>
                            <Select
                              value={row.companyWorkerId || NONE_VALUE}
                              onValueChange={(v) =>
                                updateMemberRow(row.rowKey, { companyWorkerId: v === NONE_VALUE ? "" : v })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={labels.memberPlaceholder} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE_VALUE}>{labels.memberPlaceholder}</SelectItem>
                                {selectWorkers.map((w) => (
                                  <SelectItem key={w.id} value={w.id}>
                                    {workerDisplayName(w)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-full sm:w-52 space-y-1 shrink-0">
                            <label className="text-xs text-muted-foreground">{labels.memberRole}</label>
                            <Select
                              value={row.role}
                              onValueChange={(v) => updateMemberRow(row.rowKey, { role: v as ProjectMemberRole })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PROJECT_MEMBER_ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {roleLabels[role]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-destructive self-end"
                            onClick={() => removeMemberRow(row.rowKey)}
                            aria-label={labels.removeMember}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addMemberRow}>
                  <UserPlus className="h-4 w-4" />
                  {labels.addMember}
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                <p className="text-sm font-medium">{labels.docsSection}</p>
                <p className="text-xs text-muted-foreground">{labels.docsHint}</p>
                {existingDocs.length > 0 && (
                  <ul className="space-y-2 text-sm">
                    {existingDocs.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5"
                      >
                        <span className="truncate min-w-0" title={doc.originalFilename}>
                          {doc.originalFilename}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          {formatBytes(doc.fileSize)}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => void handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            aria-label={labels.download}
                          >
                            {downloadingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          {onDeleteDocument && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDocToDelete(doc)}
                              aria-label={labels.deleteDoc}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-4 w-4" />
                    {labels.addFiles}
                  </Button>
                </div>
                {pendingFiles.length > 0 && (
                  <ul className="space-y-1 text-sm border-t pt-2">
                    {pendingFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground">{f.name}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removePending(i)}>
                          {labels.removePending}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {labels.cancel}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {labels.saving}
                    </>
                  ) : (
                    labels.save
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!docToDelete} onOpenChange={() => !deletingDoc && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteDocTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {labels.deleteDocDesc}{" "}
              <strong>{docToDelete?.originalFilename}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoc}>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteDoc();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingDoc}
            >
              {deletingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : labels.deleteDoc}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

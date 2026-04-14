import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileUp, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkerExpenseSheetAttachmentRecord } from "@/types/workerExpenses";

type TFn = (key: string) => string;

function formatBytes(n: number | null): string {
  if (n == null || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExpenseSheetAttachmentsList(props: {
  attachments: WorkerExpenseSheetAttachmentRecord[];
  localeTag: string;
  t: TFn;
  /** Si se pasa, muestra botón eliminar por fila */
  onDelete?: (id: string) => void;
  deletePendingId?: string | null;
  onOpen: (a: WorkerExpenseSheetAttachmentRecord) => void;
  openPendingId?: string | null;
}) {
  const { attachments, localeTag, t, onDelete, deletePendingId, onOpen, openPendingId } = props;

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground py-1">{t("admin.expenses.attachments_empty")}</p>;
  }

  return (
    <ul className="space-y-2" role="list">
      {attachments.map((a) => (
        <li
          key={a.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate" title={a.originalFilename}>
              {a.originalFilename}
            </p>
            <p className="text-xs text-muted-foreground">
              {a.expenseDate
                ? new Date(`${a.expenseDate}T12:00:00`).toLocaleDateString(localeTag, {
                    day: "numeric",
                    month: "short",
                  })
                : t("admin.expenses.attachments_period_wide")}
              {" · "}
              {formatBytes(a.fileSizeBytes)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={openPendingId === a.id}
              onClick={() => onOpen(a)}
            >
              {openPendingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("admin.expenses.attachments_open")}
            </Button>
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={deletePendingId === a.id}
                onClick={() => onDelete(a.id)}
                aria-label={t("admin.expenses.attachments_remove")}
              >
                {deletePendingId === a.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Portátiles y muchos escritorios ignoran `<input capture>`; la webcam requiere getUserMedia. */
function WebcamCaptureDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapturedFile: (file: File) => void | Promise<void>;
  onFallbackToFilePicker: () => void;
  t: TFn;
}) {
  const { open, onOpenChange, onCapturedFile, onFallbackToFilePicker, t } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    const v = videoRef.current;
    if (v) v.srcObject = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setVideoReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      return;
    }

    let cancelled = false;

    function bindStreamToVideo(stream: MediaStream) {
      let attempts = 0;
      const max = 90;
      const tryBind = () => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        const el = videoRef.current;
        if (el) {
          streamRef.current = stream;
          el.srcObject = stream;
          void el.play().catch(() => undefined);
          return;
        }
        if (attempts++ < max) requestAnimationFrame(tryBind);
        else {
          stream.getTracks().forEach((tr) => tr.stop());
          setError(t("admin.expenses.attachments_camera_error_generic"));
        }
      };
      requestAnimationFrame(tryBind);
    }

    async function start() {
      setError(null);
      setVideoReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("admin.expenses.attachments_camera_unsupported"));
        return;
      }
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "user" } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        bindStreamToVideo(stream);
      } catch (e) {
        const denied =
          e instanceof DOMException &&
          (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
        setError(
          denied
            ? t("admin.expenses.attachments_camera_error_permission")
            : t("admin.expenses.attachments_camera_error_generic")
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream, t]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2d");
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("blob");
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
      await onCapturedFile(file);
      onOpenChange(false);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.expenses.attachments_camera_dialog_title")}</DialogTitle>
          <DialogDescription>{t("admin.expenses.attachments_camera_dialog_desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
              onLoadedMetadata={() => setVideoReady(true)}
            />
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/95 p-4 text-center text-sm text-muted-foreground">
                {error}
              </div>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            <button
              type="button"
              className="text-primary underline underline-offset-2 hover:no-underline"
              onClick={() => {
                onOpenChange(false);
                onFallbackToFilePicker();
              }}
            >
              {t("admin.expenses.attachments_camera_fallback_files")}
            </button>
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("admin.expenses.attachments_camera_close")}
          </Button>
          <Button
            type="button"
            disabled={!videoReady || !!error || capturing}
            onClick={() => void handleCapture()}
          >
            {capturing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("admin.expenses.attachments_camera_capture")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseSheetAttachmentsEditor(props: {
  periodDates: string[];
  localeTag: string;
  t: TFn;
  editable: boolean;
  attachments: WorkerExpenseSheetAttachmentRecord[];
  onUploadFiles: (files: File[], expenseDate: string | null) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
  onOpen: (a: WorkerExpenseSheetAttachmentRecord) => Promise<void>;
}) {
  const { periodDates, localeTag, t, editable, attachments, onUploadFiles, onDelete, onOpen } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const WHOLE_PERIOD = "__whole__";
  const [attachDay, setAttachDay] = useState<string>(WHOLE_PERIOD);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);

  const expenseDateForNext: string | null = attachDay === WHOLE_PERIOD ? null : attachDay;

  const runUpload = async (list: FileList | null) => {
    if (!list?.length || !editable) return;
    setBusy(true);
    try {
      await onUploadFiles(Array.from(list), expenseDateForNext);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/10 p-4">
      <div className="flex items-start gap-2">
        <Paperclip className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium">{t("admin.expenses.attachments_title")}</p>
          <p className="text-xs text-muted-foreground">{t("admin.expenses.attachments_help")}</p>
        </div>
      </div>

      {editable ? (
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-end">
          <div className="space-y-1.5 min-w-[200px]">
            <Label className="text-xs">{t("admin.expenses.attachments_link_day")}</Label>
            <Select value={attachDay} onValueChange={setAttachDay}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WHOLE_PERIOD}>{t("admin.expenses.attachments_period_wide")}</SelectItem>
                {periodDates.map((d) => (
                  <SelectItem key={d} value={d}>
                    {new Date(`${d}T12:00:00`).toLocaleDateString(localeTag, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic"
              multiple
              onChange={(e) => {
                void runUpload(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {t("admin.expenses.attachments_upload_files")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => setWebcamOpen(true)}
            >
              <Camera className="h-4 w-4" />
              {t("admin.expenses.attachments_camera")}
            </Button>
            <WebcamCaptureDialog
              open={webcamOpen}
              onOpenChange={setWebcamOpen}
              onFallbackToFilePicker={() => {
                fileRef.current?.click();
              }}
              onCapturedFile={async (file) => {
                setBusy(true);
                try {
                  await onUploadFiles([file], expenseDateForNext);
                } finally {
                  setBusy(false);
                }
              }}
              t={t}
            />
          </div>
        </div>
      ) : null}

      <ExpenseSheetAttachmentsList
        attachments={attachments}
        localeTag={localeTag}
        t={t}
        onDelete={
          editable
            ? async (id) => {
                setDeleteId(id);
                try {
                  await onDelete(id);
                } finally {
                  setDeleteId(null);
                }
              }
            : undefined
        }
        deletePendingId={deleteId}
        onOpen={async (a) => {
          setOpenId(a.id);
          try {
            await onOpen(a);
          } finally {
            setOpenId(null);
          }
        }}
        openPendingId={openId}
      />
    </div>
  );
}

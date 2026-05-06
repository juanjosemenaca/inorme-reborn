import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import {
  deleteEntityDocument,
  fetchEntityDocuments,
  getEntityDocumentSignedUrl,
  uploadEntityDocument,
} from "@/api/entityDocumentsApi";
import type { EntityDocumentKind, EntityDocumentOwnerType, EntityDocumentRecord } from "@/types/entityDocuments";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  ownerType: EntityDocumentOwnerType;
  ownerId: string | null;
  onDocumentsChanged?: () => void;
};

export function EntityDocumentsSection({ ownerType, ownerId, onDocumentsChanged }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<EntityDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nextUploadKind, setNextUploadKind] = useState<EntityDocumentKind>("CV");

  useEffect(() => {
    if (!ownerId) {
      setDocs([]);
      return;
    }
    let active = true;
    setLoading(true);
    fetchEntityDocuments(ownerType, ownerId)
      .then((rows) => {
        if (active) setDocs(rows);
      })
      .catch((e) => {
        if (!active) return;
        toast({
          title: "No se pudieron cargar los documentos",
          description: e instanceof Error ? e.message : "Reintenta en unos segundos.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ownerId, ownerType, toast]);

  const handleFiles = async (list: FileList | null) => {
    if (!ownerId || !list?.length) return;
    try {
      setUploading(true);
      const kindForUpload =
        ownerType === "COMPANY_WORKER" ? nextUploadKind : ("OTHER" satisfies EntityDocumentKind);
      for (const file of Array.from(list)) {
        const created = await uploadEntityDocument({
          ownerType,
          ownerId,
          file,
          kind: kindForUpload,
        });
        setDocs((prev) => [created, ...prev]);
      }
      onDocumentsChanged?.();
    } catch (e) {
      toast({
        title: "No se pudo subir el documento",
        description: e instanceof Error ? e.message : "Reintenta en unos segundos.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (doc: EntityDocumentRecord) => {
    try {
      setOpenId(doc.id);
      const url = await getEntityDocumentSignedUrl(doc.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({
        title: "No se pudo abrir el documento",
        description: e instanceof Error ? e.message : "Reintenta en unos segundos.",
        variant: "destructive",
      });
    } finally {
      setOpenId(null);
    }
  };

  const handleDelete = async (doc: EntityDocumentRecord) => {
    if (!window.confirm(`¿Eliminar documento «${doc.originalFilename}»?`)) return;
    try {
      setDeleteId(doc.id);
      await deleteEntityDocument(doc);
      setDocs((prev) => prev.filter((x) => x.id !== doc.id));
      onDocumentsChanged?.();
    } catch (e) {
      toast({
        title: "No se pudo eliminar el documento",
        description: e instanceof Error ? e.message : "Reintenta en unos segundos.",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
      <p className="text-sm font-medium">Documentos de la ficha</p>
      {!ownerId ? (
        <p className="text-xs text-muted-foreground">
          Guarda primero la ficha para poder adjuntar documentos.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {ownerType === "COMPANY_WORKER"
              ? "Marca si el archivo es el CV (curriculum) u otro adjunto. El semáforo de completitud exige un CV subido."
              : "Puedes subir contratos, PDFs, imágenes o cualquier adjunto relevante."}
          </p>
          {ownerType === "COMPANY_WORKER" && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-xs font-medium shrink-0">Tipo del próximo archivo</span>
              <SearchableSelect
                value={nextUploadKind}
                onValueChange={(v) => setNextUploadKind(v as EntityDocumentKind)}
                options={[
                  { value: "CV", label: "Currículum (CV)" },
                  { value: "OTHER", label: "Otro documento" },
                ]}
                searchable={false}
                className="h-8 w-full sm:w-[220px] text-xs"
              />
            </div>
          )}
          {loading ? (
            <p className="text-xs text-muted-foreground">Cargando…</p>
          ) : docs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin documentos adjuntos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5"
                >
                  <span className="truncate min-w-0 flex items-center gap-2" title={doc.originalFilename}>
                    {doc.kind === "CV" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        CV
                      </Badge>
                    )}
                    <span className="truncate">{doc.originalFilename}</span>
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
                      onClick={() => void handleOpen(doc)}
                      disabled={openId === doc.id}
                      aria-label="Abrir"
                    >
                      {openId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => void handleDelete(doc)}
                      disabled={deleteId === doc.id}
                      aria-label="Eliminar"
                    >
                      {deleteId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {uploading ? "Subiendo…" : "Añadir documentos"}
          </Button>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export type DoubleConfirmAlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ejecutado solo tras la segunda confirmación */
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  secondTitle?: string;
  secondDescription?: ReactNode;
  confirmStep1Label?: string;
  confirmStep2Label?: string;
  cancelLabel?: string;
  backLabel?: string;
  disabled?: boolean;
};

/**
 * Diálogo en dos pasos para borrados y acciones destructivas irreversibles.
 */
export function DoubleConfirmAlertDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  secondTitle,
  secondDescription,
  confirmStep1Label,
  confirmStep2Label,
  cancelLabel,
  backLabel,
  disabled = false,
}: DoubleConfirmAlertDialogProps) {
  const { t } = useLanguage();
  const [stage, setStage] = useState<1 | 2>(1);

  useEffect(() => {
    if (open) setStage(1);
  }, [open]);

  const tContinue = confirmStep1Label ?? t("admin.common.double_confirm_continue");
  const tFinal = confirmStep2Label ?? t("admin.common.double_confirm_final");
  const tCancel = cancelLabel ?? t("admin.common.cancel");
  const tBack = backLabel ?? t("admin.common.double_confirm_back");
  const t2Title = secondTitle ?? t("admin.common.double_confirm_step2_title");
  const t2Desc = secondDescription ?? t("admin.common.double_confirm_step2_desc");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{stage === 1 ? title : t2Title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="text-sm text-muted-foreground space-y-2">
          {stage === 1 ? description : t2Desc}
        </div>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          {stage === 1 ? (
            <>
              <AlertDialogCancel disabled={disabled} type="button">
                {tCancel}
              </AlertDialogCancel>
              <Button type="button" disabled={disabled} onClick={() => setStage(2)}>
                {tContinue}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setStage(1)}>
                {tBack}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={disabled}
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
              >
                {tFinal}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useEffect } from "react";
import { addDays, dateToLocalYmd } from "@/components/admin/WorkerAgendaTimeViews";
import {
  agendaFutureNoticeSignature,
  computeAgendaFutureBeyondDashboardSummary,
  writeAgendaFutureNoticeAck,
} from "@/lib/workerAgendaFutureNotice";
import { useWorkerAgendaItems } from "@/hooks/useWorkerAgenda";

/**
 * Al visitar la agenda o el calendario laboral, marca como vistas las entradas
 * que disparan el aviso del panel (react-query reutiliza la misma query que el dashboard).
 */
export function useWriteAgendaFutureDashboardNoticeAck(workerId: string | null, enabled: boolean) {
  const todayYmd = dateToLocalYmd(new Date());
  const horizonToIso = dateToLocalYmd(addDays(new Date(), 400));
  const { data: rawAgendaHorizon = [], isSuccess: horizonReady } = useWorkerAgendaItems(
    workerId,
    todayYmd,
    horizonToIso,
    enabled && !!workerId
  );

  useEffect(() => {
    if (!workerId || !enabled || !horizonReady) return;
    const future = computeAgendaFutureBeyondDashboardSummary({
      rawAgendaHorizon,
      referenceLocalYmd: todayYmd,
    });
    writeAgendaFutureNoticeAck(workerId, agendaFutureNoticeSignature(future));
  }, [workerId, enabled, horizonReady, rawAgendaHorizon, todayYmd]);
}

import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  /** Etiqueta «Hoy» / «Today» / «Avui» */
  todayTitle: string;
  language: string;
  localeTag: string;
};

/** Fecha actual en la misma tarjeta que el panel del trabajador. */
export function BackofficeTodayDateCard({ todayTitle, language, localeTag }: Props) {
  const now = new Date();
  const weekdayLong = now.toLocaleDateString(localeTag, { weekday: "long" });
  const weekdayDisplay = weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1);
  const calendarDay = now.getDate();
  const monthName = now.toLocaleDateString(localeTag, { month: "long" });
  const yearNum = now.getFullYear();

  return (
    <Card className="shrink-0 w-full min-w-0 max-w-full border-2 border-primary/15 bg-primary/[0.03] shadow-sm sm:w-fit">
      <CardContent className="overflow-x-auto px-3 py-2 sm:py-2.5 [scrollbar-width:thin]">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p
            className="whitespace-nowrap text-sm font-normal leading-tight text-foreground"
            lang={localeTag}
          >
            {todayTitle}
            {", "}
            <strong className="font-bold">{weekdayDisplay}</strong>
            {", "}
            {language === "en" ? (
              <>
                <strong className="font-bold">{calendarDay}</strong>{" "}
                <strong className="font-bold capitalize">{monthName}</strong> {yearNum}
              </>
            ) : (
              <>
                <strong className="font-bold">{calendarDay}</strong>
                {" de "}
                <strong className="font-bold capitalize">{monthName}</strong>
                {" de "}
                {yearNum}
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

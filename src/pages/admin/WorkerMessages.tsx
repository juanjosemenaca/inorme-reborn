import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyBackofficeMessages } from "@/hooks/useBackofficeMessages";
import { markBackofficeMessageAsRead } from "@/api/backofficeMessagesApi";
import { queryKeys } from "@/lib/queryKeys";

const WorkerMessages = () => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { data: messages = [], isLoading, isError, error } = useMyBackofficeMessages();

  const localeTag = language === "en" ? "en-GB" : language === "ca" ? "ca-ES" : "es-ES";
  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString(localeTag, { dateStyle: "short", timeStyle: "short" });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markBackofficeMessageAsRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessages });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backofficeMessageUnreadCount });
    },
  });

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
      <p className="text-destructive text-sm py-8">
        {error instanceof Error ? error.message : t("admin.messages.load_error")}
      </p>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" aria-hidden />
          {t("admin.messages.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.messages.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.messages.inbox_title")}</CardTitle>
          <CardDescription>{t("admin.common.showing")} {messages.length}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("admin.messages.empty")}</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border p-4 space-y-2 ${m.readAt ? "bg-muted/20" : "bg-primary/5 border-primary/30"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{m.title}</p>
                    {m.readAt ? (
                      <Badge variant="outline">{t("admin.messages.read_badge")}</Badge>
                    ) : (
                      <Badge>{t("admin.messages.unread_badge")}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDt(m.createdAt)}</p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                {!m.readAt ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={markReadMutation.isPending}
                    onClick={() => markReadMutation.mutate(m.id)}
                  >
                    {t("admin.messages.mark_read")}
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerMessages;

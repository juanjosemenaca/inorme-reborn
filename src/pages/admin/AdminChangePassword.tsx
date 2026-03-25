import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { completePasswordChange } from "@/api/backofficeUsersApi";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInputWithToggle } from "@/components/ui/password-input";

type FormValues = { password: string; confirm: string };

function AdminChangePasswordInner() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { refreshSession } = useAdminAuth();
  const [submitting, setSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(8, t("admin.passwordChange.validation_min")),
          confirm: z.string().min(8, t("admin.passwordChange.validation_min")),
        })
        .refine((data) => data.password === data.confirm, {
          message: t("admin.passwordChange.validation_match"),
          path: ["confirm"],
        }),
    [t]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await completePasswordChange(values.password);
      await refreshSession();
      navigate("/admin", { replace: true });
    } catch (e) {
      form.setError("root", {
        message: e instanceof Error ? e.message : t("admin.passwordChange.save_error"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">{t("admin.passwordChange.title")}</CardTitle>
        <CardDescription>{t("admin.passwordChange.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.passwordChange.new_label")}</FormLabel>
                  <FormControl>
                    <PasswordInputWithToggle autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.passwordChange.confirm_label")}</FormLabel>
                  <FormControl>
                    <PasswordInputWithToggle autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.root.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("admin.passwordChange.saving")}
                </>
              ) : (
                t("admin.passwordChange.submit")
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function AdminChangePassword() {
  const { language } = useLanguage();
  return <AdminChangePasswordInner key={language} />;
}

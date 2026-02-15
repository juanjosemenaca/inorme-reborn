import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const Contact = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar que sea PDF
      if (file.type !== "application/pdf") {
        toast({
          title: "Error",
          description: "Por favor, selecciona un archivo PDF",
          variant: "destructive" as const,
        });
        e.target.value = ""; // Limpiar el input
        return;
      }
      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "El archivo no debe superar los 5MB",
          variant: "destructive" as const,
        });
        e.target.value = ""; // Limpiar el input
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      toast({
        title: t("contact_toast_title"),
        description: t("contact_toast_desc"),
      });
      setIsSubmitting(false);
      setSelectedFile(null);
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <section id="contacto" className="py-24 lg:py-32 bg-section-dark relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left side: solo título */}
          <div>
            <div>
              <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
                {t("contact_label")}
              </span>
              <h2 className="text-3xl lg:text-[2.75rem] font-bold text-white leading-tight">
                {t("contact_title")}{" "}
                <span className="font-serif italic font-normal text-gradient-orange">
                  {t("contact_project")}
                </span>
              </h2>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white/[0.04] rounded-3xl p-8 lg:p-10 border border-white/[0.08]">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">
                    {t("contact_name")}
                  </label>
                  <Input
                    required
                    placeholder={t("contact_name_placeholder")}
                    className="rounded-xl h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">
                    {t("contact_company")}
                  </label>
                  <Input
                    placeholder={t("contact_company_placeholder")}
                    className="rounded-xl h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-primary/40"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  {t("contact_email")} *
                </label>
                <Input
                  type="email"
                  required
                  placeholder={t("contact_email_placeholder")}
                  className="rounded-xl h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-primary/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  {t("contact_help")}
                </label>
                <Textarea
                  required
                  placeholder={t("contact_help_placeholder")}
                  className="rounded-xl min-h-[130px] bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-primary/40 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  {t("contact_file")}
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="cv-upload"
                  />
                  <label
                    htmlFor="cv-upload"
                    className="flex items-center gap-3 cursor-pointer rounded-xl h-11 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/40 transition-all px-4 text-white/60 hover:text-white"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span className="text-sm flex-1 truncate">
                      {selectedFile ? selectedFile.name : t("contact_file_placeholder")}
                    </span>
                  </label>
                </div>
                {selectedFile && (
                  <p className="text-xs text-white/40 mt-1.5">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="rounded-full h-12 px-8 text-sm font-semibold gap-2 group w-full sm:w-auto shadow-md shadow-primary/20"
              >
                {isSubmitting ? t("contact_sending") : t("contact_send")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;

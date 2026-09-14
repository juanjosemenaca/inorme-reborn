import type { LegalDocumentContent } from "@/types/legal";

type LegalDocumentProps = {
  document: LegalDocumentContent;
};

const LegalDocument = ({ document }: LegalDocumentProps) => {
  return (
    <article className="prose prose-neutral max-w-none dark:prose-invert">
      <header className="mb-10 not-prose">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
          {document.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{document.updated}</p>
        {document.intro ? (
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">{document.intro}</p>
        ) : null}
      </header>

      <div className="space-y-8">
        {document.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold text-foreground mb-3">{section.title}</h2>
            <div className="space-y-3">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
};

export default LegalDocument;

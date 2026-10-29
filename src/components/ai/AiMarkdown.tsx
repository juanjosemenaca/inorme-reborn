import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type AiMarkdownProps = {
  content: string;
  className?: string;
};

/**
 * Render de Markdown (GFM: tablas, listas, negritas) con estilos de Inorme.
 * Sin HTML embebido: react-markdown lo escapa por defecto.
 */
export function AiMarkdown({ content, className }: AiMarkdownProps) {
  return (
    <div className={cn("ai-markdown space-y-2 text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="text-base font-semibold tracking-tight mt-2">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-semibold tracking-tight mt-2">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold mt-2">{children}</h4>,
          h4: ({ children }) => <h5 className="text-sm font-semibold mt-1">{children}</h5>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="text-muted-foreground">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          img: () => null,
          code: ({ children, className: codeClass }) => {
            const block = typeof codeClass === "string" && codeClass.includes("language-");
            return block ? (
              <pre className="rounded-md bg-muted p-2 text-xs overflow-x-auto">
                <code>{children}</code>
              </pre>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>
            );
          },
          hr: () => <hr className="my-2 border-border" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 w-full overflow-x-auto rounded-md border">
              <table className="w-full text-xs sm:text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          tbody: ({ children }) => <tbody className="[&_tr:last-child]:border-0">{children}</tbody>,
          tr: ({ children }) => <tr className="border-b transition-colors hover:bg-muted/40">{children}</tr>,
          th: ({ children, style }) => (
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap" style={style}>
              {children}
            </th>
          ),
          td: ({ children, style }) => (
            <td className="px-3 py-1.5 align-top tabular-nums" style={style}>
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

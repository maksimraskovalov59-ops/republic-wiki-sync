import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize from "rehype-sanitize";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractHeadings(content: string) {
  const headings: { id: string; text: string; level: number }[] = [];
  const seen = new Set<string>();
  content.split("\n").forEach((line) => {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (!match) return;
    const [, prefix, rawText] = match;
    if (!prefix || rawText == null) return;
    const level = prefix.length;
    let text = rawText.trim();
    let id = slugify(text);
    let count = 1;
    while (seen.has(id)) id = `${slugify(text)}-${count++}`;
    seen.add(id);
    headings.push({ id, text, level });
  });
  return headings;
}

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        h1: ({ children }) => <h1 className="mt-8 mb-4 text-3xl font-extrabold text-foreground sm:text-4xl">{children}</h1>,
        h2: ({ children }) => {
          const text = React.Children.toArray(children).join("");
          const id = slugify(text);
          return (
            <h2 id={id} className="mt-10 mb-3 scroll-mt-24 text-xl font-bold text-foreground sm:text-2xl">
              {children}
            </h2>
          );
        },
        h3: ({ children }) => {
          const text = React.Children.toArray(children).join("");
          const id = slugify(text);
          return (
            <h3 id={id} className="mt-7 mb-2 scroll-mt-24 text-lg font-semibold text-foreground">
              {children}
            </h3>
          );
        },
        p: ({ children }) => <p className="my-4 text-sm leading-7 text-muted-foreground sm:text-base">{children}</p>,
        ul: ({ children }) => <ul className="my-4 ml-5 list-disc space-y-2 text-sm leading-7 text-muted-foreground sm:text-base">{children}</ul>,
        ol: ({ children }) => <ol className="my-4 ml-5 list-decimal space-y-2 text-sm leading-7 text-muted-foreground sm:text-base">{children}</ol>,
        li: ({ children }) => <li className="pl-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-5 border-l-2 border-magenta bg-secondary/60 px-4 py-3 italic text-foreground">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm text-muted-foreground">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-border px-3 py-2 text-left text-foreground">{children}</th>,
        td: ({ children }) => <td className="border border-border px-3 py-2 align-top">{children}</td>,
        a: ({ href, children }) => <a href={href} className="text-cyan hover:underline">{children}</a>,
        img: ({ src, alt }) => <img src={src} alt={alt} className="my-6 rounded-lg border border-border" />,
        code: ({ children }) => <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground">{children}</code>,
        pre: ({ children }) => <pre className="my-5 overflow-x-auto rounded-lg border border-border bg-secondary/80 p-4 text-xs text-foreground">{children}</pre>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-foreground">{children}</em>,
        hr: () => <hr className="my-8 border-border" />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

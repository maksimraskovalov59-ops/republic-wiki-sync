import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        h1: ({ children }) => <h1 className="pt-2 text-3xl font-extrabold text-foreground sm:text-4xl">{children}</h1>,
        h2: ({ children }) => {
          const text = React.Children.toArray(children).join("");
          const id = slugify(text);
          return (
            <h2 id={id} className="scroll-mt-24 pt-6 text-xl font-bold text-foreground sm:text-2xl">
              {children}
            </h2>
          );
        },
        h3: ({ children }) => {
          const text = React.Children.toArray(children).join("");
          const id = slugify(text);
          return (
            <h3 id={id} className="scroll-mt-24 pt-4 text-lg font-semibold text-foreground">
              {children}
            </h3>
          );
        },
        p: ({ children }) => <p className="text-sm leading-7 text-muted-foreground sm:text-base">{children}</p>,
        ul: ({ children }) => <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground sm:text-base">{children}</ul>,
        ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1 text-sm text-muted-foreground sm:text-base">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-magenta bg-secondary/60 px-4 py-3 italic text-foreground">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => <a href={href} className="text-cyan hover:underline">{children}</a>,
        img: ({ src, alt }) => <img src={src} alt={alt} className="my-4 rounded-lg border border-border" />,
        code: ({ children }) => <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground">{children}</code>,
        pre: ({ children }) => <pre className="overflow-x-auto rounded-lg border border-border bg-secondary/80 p-4 text-xs text-foreground">{children}</pre>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-foreground">{children}</em>,
        hr: () => <hr className="my-6 border-border" />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

import { Fragment } from "react";

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * Renders lesson body text with lightweight formatting:
 * blank lines, `## ` headings, `- ` bullets, `1. ` numbered lists and **bold**.
 */
export function LessonContent({ content }: { content: string | null }) {
  if (!content) {
    return <p className="text-muted-foreground">No lesson notes yet.</p>;
  }

  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      // Blank line: implicitly ends any open list (handled by list grouping below).
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={key++} className="mt-4 text-base font-semibold first:mt-0">
          {renderInline(line.slice(3).trim())}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2).trim());
        i++;
      }
      i--;
      blocks.push(
        <ul key={key++} className="mt-2 list-disc space-y-1 pl-5 first:mt-0">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      let order = 0;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        order = Number.parseInt(lines[i], 10);
        items.push(lines[i].replace(/^\d+\.\s/, "").trim());
        i++;
      }
      i--;
      void order;
      blocks.push(
        <ol key={key++} className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    blocks.push(
      <p key={key++} className="mt-2 first:mt-0">
        {renderInline(line.trim())}
      </p>,
    );
  }

  return <div className="space-y-0 text-sm leading-relaxed">{blocks}</div>;
}
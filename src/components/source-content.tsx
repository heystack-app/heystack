"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Minimal CSV parser that respects quoted fields (SheetJS quotes fields that
// contain commas), so spreadsheet sources render as proper tables.
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function CsvTable({ csv }: { csv: string }) {
  const rows = parseCsv(csv);
  if (rows.length === 0) return null;
  const [head, ...body] = rows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="border-b border-black/10 px-2 py-1.5 text-left font-semibold dark:border-white/10"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className="border-b border-black/5 px-2 py-1.5 align-top dark:border-white/5"
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render one stored chunk nicely based on the document's type. */
export function SourceChunk({
  mimeType,
  content,
}: {
  mimeType: string;
  content: string;
}) {
  if (mimeType === "text/markdown") {
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:overflow-x-auto prose-pre:rounded-lg">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }
  if (mimeType.includes("spreadsheet") || mimeType === "text/csv") {
    return <CsvTable csv={content} />;
  }
  // Word, PowerPoint, plain text: readable paragraphs rather than a raw dump.
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      {content.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {p}
        </p>
      ))}
    </div>
  );
}

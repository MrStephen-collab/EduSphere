export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  return rows;
}

export type CsvMapping = Record<string, string>;

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Maps parsed CSV rows to objects using the header row. Stops at any alias
 * found; throws if two header cells resolve to the same normalized alias.
 */
export function mapCsvRows(
  rows: string[][],
  columnAliases: Record<string, string[]>,
): CsvMapping[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map(normalizeHeader);

  const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");

  const aliasByHeader: Record<string, string> = {};
  for (const [key, aliases] of Object.entries(columnAliases)) {
    for (const header of headers) {
      if (aliases.map(normalize).includes(normalize(header))) {
        if (aliasByHeader[header]) {
          throw new Error(`CSV column "${header}" matches multiple fields.`);
        }
        aliasByHeader[header] = key;
      }
    }
  }

  return rows.slice(1).map((cells) => {
    const obj: CsvMapping = {};
    headers.forEach((header, index) => {
      const key = aliasByHeader[header];
      if (key && cells[index] !== undefined) obj[key] = cells[index].trim();
    });
    return obj;
  });
}
/** Tiny markdown table reader for doc-sync tests. */

/** The rows of the first markdown table after `heading`, as trimmed cells (header and rule skipped). */
export function tableAfter(doc: string, heading: string): string[][] {
  const start = doc.indexOf(heading);
  if (start < 0) throw new Error(`the doc has no "${heading}"`);
  const lines = doc.slice(start).split('\n');
  const first = lines.findIndex((l) => l.startsWith('|'));
  const rows: string[][] = [];
  for (const line of lines.slice(first + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(
      line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    );
  }
  return rows;
}

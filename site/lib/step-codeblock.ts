export interface StepCodeBlockInput {
  title: string;
  description: string;
  code: string;
  commentPrefix?: string;
  commentSuffix?: string;
  maxCommentWidth?: number;
}

function wrapLine(text: string, width: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= width) {
      current = word;
      continue;
    }
    let rest = word;
    while (rest.length > width) {
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines;
}

export function renderStepCodeBlock(input: StepCodeBlockInput): string {
  const prefix = input.commentPrefix ?? "# ";
  const suffix = input.commentSuffix ?? "";
  const width = input.maxCommentWidth ?? 72;
  const out: string[] = [];
  out.push(`${prefix}${input.title}${suffix}`);
  for (const line of wrapLine(input.description, width)) out.push(`${prefix}${line}${suffix}`);
  out.push(...input.code.split("\n"));
  return out.join("\n");
}

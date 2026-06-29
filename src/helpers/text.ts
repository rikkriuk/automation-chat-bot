export function stripMarkdown(text: string): string {
   return text
      .replace(/[*_~`[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();
}
export function extractJsonBlock(text: string): unknown | null {
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through la cautare object la nivel raw
    }
  }

  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  return null;
}

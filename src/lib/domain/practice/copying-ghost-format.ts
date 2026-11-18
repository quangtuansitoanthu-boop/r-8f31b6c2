import { withoutCopyNotes } from './scripture-copying';
import type { CopySourceLine } from './copying-formatting';
import type { TypedRun } from './copying-typed-format';

/** Convert canonical scripture sentences into styled runs for the ghost tracing underlay. */
export function formatGhostRuns(source: CopySourceLine[]): TypedRun[] {
  const runs: TypedRun[] = [];
  source.forEach((sentence, index) => {
    const line = sentence.paragraph ?? index;
    const previous = runs[runs.length - 1];
    if (previous && previous.line !== line && !previous.text.endsWith('\n') && !sentence.parts[0]?.text.startsWith('\n')) {
      runs.push({ ...previous, text: '\n' });
    }
    for (const part of sentence.parts) {
      if (!part.text) continue;
      const last = runs[runs.length - 1];
      if (last && last.bold === part.bold && last.line === line && last.align === sentence.align) {
        last.text += part.text;
      } else {
        runs.push({
          text: part.text,
          bold: part.bold,
          align: sentence.align,
          line,
        });
      }
    }
  });
  const sourceText = runs.map(run => run.text).join('');
  const masked = withoutCopyNotes(sourceText, '\0');
  if (masked === sourceText) return runs;
  // Trim spacing introduced around a removed note while retaining paragraph breaks.
  const omitted = new Set<number>();
  // A line occupied entirely by guidance must not leave a second separator.
  for (const match of masked.matchAll(/(^|\r?\n)[ \t\0]*\0[ \t\0]*(?=\r?\n|$)/gu)) {
    const paragraphEnd = match.index + match[0].length;
    const separator = masked.slice(paragraphEnd, paragraphEnd + 2).startsWith('\r\n') ? 2 : 1;
    const end = Math.min(masked.length, paragraphEnd + separator);
    const start = paragraphEnd === masked.length ? match.index : match.index + match[1].length;
    for (let index = start; index < end; index++) omitted.add(index);
  }
  for (const match of masked.matchAll(/\0+(?:[ \t]*\0+)*/gu)) {
    let start = match.index;
    let end = start + match[0].length;
    if (start === 0 || /\s/u.test(masked[start - 1])) {
      while (/[ \t]/u.test(masked[end] ?? '')) end++;
    }
    if (end === masked.length || /[.,!?;:…\r\n。！？]/u.test(masked[end])) {
      while (start > 0 && /[ \t]/u.test(masked[start - 1])) start--;
    }
    for (let index = start; index < end; index++) omitted.add(index);
  }
  let offset = 0;
  return runs.flatMap(run => {
    const text = run.text.split('').filter((_, index) => !omitted.has(offset + index)).join('');
    offset += run.text.length;
    return text ? [{ ...run, text }] : [];
  });
}

/** Share raw draft glyph metrics with the ghost; this never grants tracing eligibility. */
export function alignGhostRuns(runs: TypedRun[], typed: string): TypedRun[] | null {
  const key = (text: string) => text.normalize('NFC').toLocaleLowerCase('vi');
  const canonical = runs.map(run => run.text).join('');
  const masked = withoutCopyNotes(typed, '\0');
  const hasNotes = masked !== typed;
  const compact = (value: string) => value.replace(/\s+/gu, ' ').trim();
  const prefix = key(typed);
  if (!canonical) return typed ? null : runs;
  const sourceEnd = (text: string, normalizedLength: number) => {
    if (!normalizedLength) return 0;
    let end = 0;
    for (const character of text) {
      end += character.length;
      if (key(text.slice(0, end)).length >= normalizedLength) {
        while (end < text.length && /\p{M}/u.test(text[end])) end++;
        return end;
      }
    }
    return text.length;
  };
  let canonicalEnd = sourceEnd(canonical, prefix.length);
  if (hasNotes && !canonical.startsWith(typed)) {
    const typedBody = compact(key(masked.replaceAll('\0', '')));
    const referenceBody = compact(key(canonical));
    if (referenceBody.startsWith(typedBody)) {
      canonicalEnd = 0;
      while (compact(key(canonical.slice(0, canonicalEnd))).length < typedBody.length) canonicalEnd++;
      if (/\s$/u.test(typed) && /\s/u.test(canonical[canonicalEnd] ?? '')) canonicalEnd++;
      const remaining = clipGhostRuns(runs, canonicalEnd);
      const first = runs[0];
      return [{ ...first, text: typed }, ...remaining];
    }
  }
  let offset = 0, consumed = 0;
  const aligned = runs.map(run => {
    const count = Math.max(0, Math.min(run.text.length, canonicalEnd - offset));
    const next = sourceEnd(typed, key(canonical.slice(0, offset + count)).length);
    const text = count ? typed.slice(consumed, next) + run.text.slice(count) : run.text;
    offset += run.text.length;
    if (count) consumed = next;
    return { ...run, text };
  });
  // A restored draft may extend beyond the reference. Its extra text remains
  // visible and selectable rather than being truncated by display formatting.
  if (consumed < typed.length) aligned[aligned.length - 1].text += typed.slice(consumed);
  return aligned;
}

/** Clip ghost runs to an active page range without altering line groupings or alignments. */
export function clipGhostRuns(runs: TypedRun[], start = 0, end = Infinity): TypedRun[] {
  let offset = 0;
  return runs.flatMap(run => {
    const left = Math.max(start, offset), right = Math.min(end, offset + run.text.length);
    const clipped = right > left ? [{ ...run, text: run.text.slice(left - offset, right - offset) }] : [];
    offset += run.text.length;
    return clipped;
  });
}

export interface GhostTraceInput {
  key?: string;
  inputType?: string;
  isBackspace?: boolean;
}

const normalizeChar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Calculates the next typed text slice when tracing ghost text.
 * Every keystroke advances along the canonical scripture without typo drift.
 */
export function nextGhostTraceText(
  canonical: string,
  current: string,
  input: GhostTraceInput
): string {
  if (input.isBackspace) {
    if (!current) return '';
    return current.slice(0, current.length - 1);
  }

  const currentLength = current.length;
  if (currentLength >= canonical.length) return canonical;

  const typedKey = input.key ?? '';
  // If the user typed a letter key and the canonical text currently has punctuation/spaces before that letter:
  if (typedKey && typedKey.length === 1 && !/\s/.test(typedKey)) {
    const remaining = canonical.slice(currentLength);
    const match = remaining.match(/^([.,!?:;…\s—()（）""'']+)*/u);
    if (match && match[0]) {
      const skipLength = match[0].length;
      const targetChar = remaining[skipLength];
      if (targetChar && normalizeChar(targetChar) === normalizeChar(typedKey)) {
        return canonical.slice(0, currentLength + skipLength + 1);
      }
    }
  }

  // Standard advance: take 1 character from canonical text
  return canonical.slice(0, currentLength + 1);
}

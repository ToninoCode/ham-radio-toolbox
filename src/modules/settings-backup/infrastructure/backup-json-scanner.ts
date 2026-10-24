import { Sha256 } from "@/infrastructure/files/sha256";

/*
 * Streaming scanner of the backup envelope (format v1, ADR-0015). It walks
 * the root object and the `tables` object character by character, without
 * ever holding the whole file: every root value and every record is
 * captured as text and parsed on its own, and each table's array is hashed
 * while it passes. The scanner checks the layout (member order, unknown or
 * duplicate members, trailing data) and size limits; the meaning of values
 * is checked by the codec and by the use cases.
 */

export type ScanErrorCode =
  | "backup.empty"
  | "backup.not-a-backup"
  | "backup.json-invalid"
  | "backup.unknown-field"
  | "backup.layout-invalid"
  | "backup.table-duplicate"
  | "backup.record-too-large"
  | "backup.truncated";

/** Structural problem of the file, with technical details. */
export class BackupScanError extends Error {
  readonly code: ScanErrorCode;
  readonly detail: Readonly<Record<string, string | number>>;

  constructor(
    code: ScanErrorCode,
    detail: Readonly<Record<string, string | number>> = {},
  ) {
    super(code);
    this.name = "BackupScanError";
    this.code = code;
    this.detail = detail;
  }
}

export type ScanEvent =
  | { readonly type: "member"; readonly key: string; readonly value: unknown }
  | { readonly type: "tables-start" }
  | { readonly type: "table-start"; readonly table: string }
  | {
      readonly type: "record";
      readonly table: string;
      readonly index: number;
      /** JSON text of the record, not parsed yet. */
      readonly text: string;
    }
  | {
      readonly type: "table-end";
      readonly table: string;
      readonly count: number;
      /** SHA-256 of the table's array text (UTF-8), from `[` to `]`. */
      readonly sha256: string;
    };

export interface ScanOptions {
  /** Root members allowed before `tables`; the first must be `format`. */
  readonly headerFields: readonly string[];
  /** Longest root value (header fields, integrity), in characters. */
  readonly maxMemberChars: number;
  /** Longest record of a table, in characters. */
  readonly recordChars: (table: string) => number;
}

const MODE = {
  ROOT_START: 0,
  ROOT_FIRST_KEY: 1,
  ROOT_NEXT_KEY: 2,
  ROOT_COLON: 3,
  ROOT_VALUE: 4,
  ROOT_AFTER: 5,
  TABLES_FIRST_KEY: 6,
  TABLES_NEXT_KEY: 7,
  TABLE_COLON: 8,
  TABLE_ARRAY: 9,
  ELEMENT_FIRST: 10,
  ELEMENT_NEXT: 11,
  ELEMENT_AFTER: 12,
  TABLES_AFTER: 13,
  DONE: 14,
} as const;
type Mode = (typeof MODE)[keyof typeof MODE];

const KIND = { ROOT_KEY: 0, ROOT_VALUE: 1, TABLE_KEY: 2, ELEMENT: 3 } as const;
type Kind = (typeof KIND)[keyof typeof KIND];

const QUOTE = 0x22;
const COMMA = 0x2c;
const COLON = 0x3a;
const OPEN_BRACKET = 0x5b;
const BACKSLASH = 0x5c;
const CLOSE_BRACKET = 0x5d;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

/** Longest member or table name. */
const MAX_KEY_CHARS = 256;

function isWhitespace(c: number): boolean {
  return c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09;
}

function isHighSurrogate(c: number): boolean {
  return c >= 0xd800 && c <= 0xdbff;
}

interface Capture {
  readonly kind: Kind;
  readonly limit: number;
  readonly parts: string[];
  length: number;
  /** Start of the captured text in the current chunk. */
  start: number;
  depth: number;
  inString: boolean;
  escape: boolean;
  primitive: boolean;
}

const encoder = new TextEncoder();

export class BackupJsonScanner {
  readonly #options: ScanOptions;
  #mode: Mode = MODE.ROOT_START;
  #capture: Capture | null = null;
  readonly #rootKeys = new Set<string>();
  #rootKey = "";
  readonly #tables = new Set<string>();
  #table = "";
  #index = 0;
  #hash: Sha256 | null = null;
  /** Start of the hashed text in the current chunk. */
  #hashFrom = 0;
  /** High surrogate held back at a chunk end, so pairs are encoded whole. */
  #hashCarry = "";
  /** Characters of the previous chunks (diagnostics). */
  #offset = 0;
  #sawContent = false;

  constructor(options: ScanOptions) {
    this.#options = options;
  }

  /** Scans the next piece of text; returns the events it completes. */
  write(chunk: string): ScanEvent[] {
    const events: ScanEvent[] = [];
    const n = chunk.length;
    this.#hashFrom = 0;
    let i = 0;
    while (i < n) {
      if (this.#capture) {
        i = this.#scanCapture(chunk, i, events);
        continue;
      }
      const c = chunk.charCodeAt(i);
      if (isWhitespace(c)) {
        i++;
        continue;
      }
      this.#sawContent = true;
      i = this.#step(chunk, i, c, events);
    }

    const capture = this.#capture;
    if (capture) {
      const piece = chunk.slice(capture.start);
      capture.parts.push(piece);
      capture.length += piece.length;
      capture.start = 0;
      if (capture.length > capture.limit) throw this.#tooLarge(capture);
    }
    if (this.#hash) this.#hashText(chunk.slice(this.#hashFrom), true);
    this.#offset += n;
    return events;
  }

  /** The input is over: the root object must be complete. */
  end(): void {
    if (this.#mode === MODE.DONE) return;
    throw new BackupScanError(
      this.#sawContent ? "backup.truncated" : "backup.empty",
    );
  }

  /** One structural character outside captures; returns the next index. */
  #step(chunk: string, i: number, c: number, events: ScanEvent[]): number {
    switch (this.#mode) {
      case MODE.ROOT_START:
        if (c !== OPEN_BRACE) throw new BackupScanError("backup.not-a-backup");
        this.#mode = MODE.ROOT_FIRST_KEY;
        return i + 1;
      case MODE.ROOT_FIRST_KEY:
        if (c !== QUOTE) throw new BackupScanError("backup.not-a-backup");
        return this.#startCapture(KIND.ROOT_KEY, chunk, i, MAX_KEY_CHARS);
      case MODE.ROOT_NEXT_KEY:
      case MODE.TABLES_NEXT_KEY:
        if (c !== QUOTE) throw this.#invalid(i);
        return this.#startCapture(
          this.#mode === MODE.ROOT_NEXT_KEY ? KIND.ROOT_KEY : KIND.TABLE_KEY,
          chunk,
          i,
          MAX_KEY_CHARS,
        );
      case MODE.ROOT_COLON:
      case MODE.TABLE_COLON:
        if (c !== COLON) throw this.#invalid(i);
        this.#mode =
          this.#mode === MODE.ROOT_COLON ? MODE.ROOT_VALUE : MODE.TABLE_ARRAY;
        return i + 1;
      case MODE.ROOT_VALUE:
        if (this.#rootKey !== "tables") {
          return this.#startCapture(
            KIND.ROOT_VALUE,
            chunk,
            i,
            this.#options.maxMemberChars,
          );
        }
        if (c !== OPEN_BRACE) throw this.#layout("tables-not-object");
        events.push({ type: "tables-start" });
        this.#mode = MODE.TABLES_FIRST_KEY;
        return i + 1;
      case MODE.ROOT_AFTER:
        if (c === CLOSE_BRACE) {
          this.#mode = MODE.DONE;
          return i + 1;
        }
        if (c !== COMMA) throw this.#invalid(i);
        if (this.#rootKey === "integrity")
          throw this.#layout("integrity-not-last");
        this.#mode = MODE.ROOT_NEXT_KEY;
        return i + 1;
      case MODE.TABLES_FIRST_KEY:
        if (c === CLOSE_BRACE) {
          this.#mode = MODE.ROOT_AFTER;
          return i + 1;
        }
        if (c !== QUOTE) throw this.#invalid(i);
        return this.#startCapture(KIND.TABLE_KEY, chunk, i, MAX_KEY_CHARS);
      case MODE.TABLE_ARRAY:
        if (c !== OPEN_BRACKET) throw this.#layout("table-not-array");
        this.#hash = new Sha256();
        this.#hashFrom = i;
        this.#index = 0;
        this.#mode = MODE.ELEMENT_FIRST;
        return i + 1;
      case MODE.ELEMENT_FIRST:
        if (c === CLOSE_BRACKET) {
          this.#endTable(chunk, i, events);
          return i + 1;
        }
        return this.#startElement(chunk, i);
      case MODE.ELEMENT_NEXT:
        return this.#startElement(chunk, i);
      case MODE.ELEMENT_AFTER:
        if (c === COMMA) {
          this.#mode = MODE.ELEMENT_NEXT;
          return i + 1;
        }
        if (c !== CLOSE_BRACKET) throw this.#invalid(i);
        this.#endTable(chunk, i, events);
        return i + 1;
      case MODE.TABLES_AFTER:
        if (c === COMMA) {
          this.#mode = MODE.TABLES_NEXT_KEY;
          return i + 1;
        }
        if (c !== CLOSE_BRACE) throw this.#invalid(i);
        this.#mode = MODE.ROOT_AFTER;
        return i + 1;
      case MODE.DONE:
        // Only whitespace may follow the root object.
        throw this.#invalid(i);
    }
  }

  #startElement(chunk: string, i: number): number {
    return this.#startCapture(
      KIND.ELEMENT,
      chunk,
      i,
      this.#options.recordChars(this.#table),
    );
  }

  #startCapture(kind: Kind, chunk: string, i: number, limit: number): number {
    const c = chunk.charCodeAt(i);
    const capture: Capture = {
      kind,
      limit,
      parts: [],
      length: 0,
      start: i,
      depth: 0,
      inString: false,
      escape: false,
      primitive: false,
    };
    if (c === QUOTE) capture.inString = true;
    else if (c === OPEN_BRACE || c === OPEN_BRACKET) capture.depth = 1;
    else if (
      c === CLOSE_BRACE ||
      c === CLOSE_BRACKET ||
      c === COMMA ||
      c === COLON
    ) {
      throw this.#invalid(i);
    } else capture.primitive = true;
    this.#capture = capture;
    return i + 1;
  }

  /** Continues the open capture; returns the index after it or `n`. */
  #scanCapture(chunk: string, i: number, events: ScanEvent[]): number {
    const capture = this.#capture!;
    const n = chunk.length;
    let j = i;
    // -2: not searched yet; -1: no backslash left in this chunk.
    let nextBackslash = -2;
    while (j < n) {
      if (capture.inString) {
        if (capture.escape) {
          capture.escape = false;
          j++;
          continue;
        }
        // Jump over string content (long base64 values) with indexOf.
        if (nextBackslash !== -1 && nextBackslash < j) {
          nextBackslash = chunk.indexOf("\\", j);
        }
        const quote = chunk.indexOf('"', j);
        const q = quote === -1 ? n : quote;
        const b = nextBackslash === -1 ? n : nextBackslash;
        if (b < q) {
          capture.escape = true;
          j = b + 1;
          continue;
        }
        if (q === n) return n;
        capture.inString = false;
        j = q + 1;
        if (capture.depth === 0) return this.#finishCapture(chunk, j, events);
        continue;
      }
      const c = chunk.charCodeAt(j);
      if (capture.primitive) {
        if (
          isWhitespace(c) ||
          c === COMMA ||
          c === CLOSE_BRACKET ||
          c === CLOSE_BRACE ||
          c === COLON
        ) {
          return this.#finishCapture(chunk, j, events);
        }
      } else if (c === QUOTE) {
        capture.inString = true;
      } else if (c === OPEN_BRACE || c === OPEN_BRACKET) {
        capture.depth++;
      } else if (c === CLOSE_BRACE || c === CLOSE_BRACKET) {
        capture.depth--;
        if (capture.depth === 0) {
          return this.#finishCapture(chunk, j + 1, events);
        }
      } else if (c === BACKSLASH) {
        throw this.#invalid(j);
      }
      j++;
    }
    return n;
  }

  #finishCapture(chunk: string, end: number, events: ScanEvent[]): number {
    const capture = this.#capture!;
    this.#capture = null;
    const last = chunk.slice(capture.start, end);
    if (capture.length + last.length > capture.limit) {
      throw this.#tooLarge(capture);
    }
    const text =
      capture.parts.length === 0 ? last : capture.parts.join("") + last;
    switch (capture.kind) {
      case KIND.ROOT_KEY:
        this.#rootMember(this.#parseKey(text, end));
        this.#mode = MODE.ROOT_COLON;
        break;
      case KIND.ROOT_VALUE:
        events.push({
          type: "member",
          key: this.#rootKey,
          value: this.#parse(text, end),
        });
        this.#mode = MODE.ROOT_AFTER;
        break;
      case KIND.TABLE_KEY: {
        const table = this.#parseKey(text, end);
        if (this.#tables.has(table)) {
          throw new BackupScanError("backup.table-duplicate", { table });
        }
        this.#tables.add(table);
        this.#table = table;
        events.push({ type: "table-start", table });
        this.#mode = MODE.TABLE_COLON;
        break;
      }
      case KIND.ELEMENT:
        events.push({
          type: "record",
          table: this.#table,
          index: this.#index++,
          text,
        });
        this.#mode = MODE.ELEMENT_AFTER;
        break;
    }
    return end;
  }

  /** Root member rules: `format` first, header, `tables`, `integrity` last. */
  #rootMember(key: string): void {
    if (this.#rootKeys.size === 0 && key !== "format") {
      throw new BackupScanError("backup.not-a-backup");
    }
    if (this.#rootKeys.has(key)) throw this.#layout("duplicate-member");
    if (key === "integrity") {
      if (!this.#rootKeys.has("tables")) throw this.#layout("member-order");
    } else if (key !== "tables") {
      if (!this.#options.headerFields.includes(key)) {
        throw new BackupScanError("backup.unknown-field", { field: key });
      }
      if (this.#rootKeys.has("tables")) throw this.#layout("member-order");
    }
    this.#rootKeys.add(key);
    this.#rootKey = key;
  }

  #endTable(chunk: string, i: number, events: ScanEvent[]): void {
    this.#hashText(chunk.slice(this.#hashFrom, i + 1), false);
    const sha256 = this.#hash!.hex();
    this.#hash = null;
    events.push({
      type: "table-end",
      table: this.#table,
      count: this.#index,
      sha256,
    });
    this.#mode = MODE.TABLES_AFTER;
  }

  #hashText(text: string, atChunkEnd: boolean): void {
    let segment = this.#hashCarry + text;
    this.#hashCarry = "";
    if (
      atChunkEnd &&
      segment.length > 0 &&
      isHighSurrogate(segment.charCodeAt(segment.length - 1))
    ) {
      this.#hashCarry = segment.slice(-1);
      segment = segment.slice(0, -1);
    }
    if (segment.length > 0) this.#hash!.update(encoder.encode(segment));
  }

  #parseKey(text: string, end: number): string {
    const key = this.#parse(text, end);
    if (typeof key !== "string") throw this.#invalid(end);
    return key;
  }

  #parse(text: string, end: number): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw this.#invalid(end);
    }
  }

  #invalid(index: number): BackupScanError {
    return new BackupScanError("backup.json-invalid", {
      location: `character ${this.#offset + index}`,
    });
  }

  #layout(reason: string): BackupScanError {
    return new BackupScanError("backup.layout-invalid", { reason });
  }

  #tooLarge(capture: Capture): BackupScanError {
    if (capture.kind === KIND.ELEMENT) {
      return new BackupScanError("backup.record-too-large", {
        location: `${this.#table}[${this.#index}]`,
        limitChars: capture.limit,
      });
    }
    return this.#layout("member-too-large");
  }
}

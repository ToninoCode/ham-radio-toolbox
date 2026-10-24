import type { MessageCatalog, ReferenceCatalog } from "./catalogs";
import type {
  LeafPaths,
  MessageLeaf,
  ParamNames,
  ParamValue,
  PluralMessage,
  TranslateArgs,
  ValueAt,
} from "./types";

export type MessageKey = LeafPaths<ReferenceCatalog>;

/**
 * Keys whose message has no placeholder. Use it for keys stored in data
 * (module manifests, route meta): `t(key)` then needs no parameters even
 * when the key is not a literal.
 */
export type PlainMessageKey = {
  [K in MessageKey]: [ParamNames<ValueAt<ReferenceCatalog, K>>] extends [never]
    ? K
    : never;
}[MessageKey];

export type Translate = <K extends MessageKey>(
  key: K,
  ...args: TranslateArgs<ValueAt<ReferenceCatalog, K>>
) => string;

const PLACEHOLDER = /\{(\w+)\}/g;

function lookup(catalog: MessageCatalog, key: string): MessageLeaf | undefined {
  let node: unknown = catalog;
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  if (typeof node === "string") return node;
  if (
    typeof node === "object" &&
    node !== null &&
    typeof (node as { other?: unknown }).other === "string"
  ) {
    return node as PluralMessage;
  }
  return undefined;
}

/** Whether `key` names a message (plain or plural) of the catalog. */
export function hasMessage(catalog: MessageCatalog, key: string): boolean {
  return lookup(catalog, key) !== undefined;
}

/**
 * Creates the `t()` function for a catalog (ADR-0008): `{name}` interpolation,
 * numbers formatted with `Intl.NumberFormat`, plural forms selected with
 * `Intl.PluralRules` from the `count` parameter.
 */
export function createTranslator(
  catalog: MessageCatalog,
  intlLocale: string,
): Translate {
  const pluralRules = new Intl.PluralRules(intlLocale);
  const numberFormat = new Intl.NumberFormat(intlLocale);

  const format = (value: ParamValue): string =>
    typeof value === "number" ? numberFormat.format(value) : value;

  return ((key: string, params?: Record<string, ParamValue>) => {
    const leaf = lookup(catalog, key);
    if (leaf === undefined) {
      if (import.meta.env.DEV) console.warn(`[i18n] Missing message: ${key}`);
      return key;
    }

    let template: string;
    if (typeof leaf === "string") {
      template = leaf;
    } else {
      const count = Number(params?.["count"] ?? 0);
      template = leaf[pluralRules.select(count)] ?? leaf.other;
    }

    return template.replace(PLACEHOLDER, (match, name: string) => {
      const value = params?.[name];
      return value === undefined ? match : format(value);
    });
  }) as Translate;
}

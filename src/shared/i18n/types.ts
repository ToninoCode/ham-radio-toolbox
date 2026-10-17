/**
 * Type machinery of the typed message catalog (ADR-0008).
 *
 * A catalog is a tree of messages. A leaf is either a template string with
 * `{name}` placeholders or a plural message keyed by `Intl.PluralRules`
 * categories (`other` is mandatory and identifies the leaf as plural).
 */

export type PluralCategory = Intl.LDMLPluralRule;

export type PluralMessage = { readonly other: string } & {
  readonly [C in Exclude<PluralCategory, "other">]?: string;
};

export type MessageLeaf = string | PluralMessage;

export interface MessageTree {
  readonly [key: string]: MessageLeaf | MessageTree;
}

type IsLeaf<T> = T extends string
  ? true
  : T extends { readonly other: string }
    ? true
    : false;

/** Dotted paths of every leaf of a catalog, e.g. `"nav.home"`. */
export type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: IsLeaf<T[K]> extends true
    ? `${Prefix}${K}`
    : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Value found at a dotted path. */
export type ValueAt<
  T,
  Path extends string,
> = Path extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? ValueAt<T[Head], Rest>
    : never
  : Path extends keyof T
    ? T[Path]
    : never;

type Placeholders<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never;

/** Placeholder names required by a leaf; plural leaves always need `count`. */
export type ParamNames<Leaf> = Leaf extends string
  ? Placeholders<Leaf>
  : Leaf extends PluralMessage
    ? Placeholders<Extract<Leaf[keyof Leaf], string>> | "count"
    : never;

export type ParamValue = string | number;

export type ParamsOf<Leaf> = {
  [P in ParamNames<Leaf>]: P extends "count" ? number : ParamValue;
};

/** Variadic arguments of `t()`: no argument when the leaf has no placeholder. */
export type TranslateArgs<Leaf> = [ParamNames<Leaf>] extends [never]
  ? []
  : [params: ParamsOf<Leaf>];

/**
 * Shape a catalog for another locale must satisfy: same keys and plural
 * structure as the reference catalog, any string content.
 */
export type CatalogShape<T> = T extends string
  ? string
  : { readonly [K in keyof T]: CatalogShape<T[K]> };

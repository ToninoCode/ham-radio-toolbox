declare const brand: unique symbol;

/**
 * Nominal ("branded") type: a `T` that has passed a specific validation or
 * normalisation. Zero runtime cost; values are created only by the factory
 * functions or Zod schemas that check the invariant, so a plain `number` in
 * kHz cannot be passed where a `FrequencyHz` is expected.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

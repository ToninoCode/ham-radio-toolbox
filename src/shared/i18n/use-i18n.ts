import {
  CATALOGS,
  DEFAULT_LOCALE,
  INTL_LOCALES,
  type Locale,
} from "./catalogs";
import { createTranslator, type Translate } from "./translate";

/** Translator of the active locale. A single locale exists in v1. */
export const t: Translate = createTranslator(
  CATALOGS[DEFAULT_LOCALE],
  INTL_LOCALES[DEFAULT_LOCALE],
);

export interface I18n {
  readonly locale: Locale;
  readonly t: Translate;
}

/**
 * Composable used by components. It returns a plain object today; switching
 * locale at runtime would make it reactive without changing call sites.
 */
export function useI18n(): I18n {
  return { locale: DEFAULT_LOCALE, t };
}

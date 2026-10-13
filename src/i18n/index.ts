import { createContext, useContext } from 'react';
import { ptPT, type Messages } from './pt-PT';

/**
 * Internacionalização.
 * A interface está completa em pt-PT. Para acrescentar inglês ou espanhol:
 *  1. criar src/i18n/en.ts (ou es.ts) exportando um objeto com o tipo Messages;
 *  2. registá-lo em DICTIONARIES;
 *  3. preencher as traduções "en"/"es" dos textos científicos (LocalizedText) nos dados.
 * O seletor de língua só deve ser ativado quando a tradução estiver completa,
 * para não misturar línguas na mesma interface.
 */
export type Locale = 'pt-PT' | 'en' | 'es';

export const SUPPORTED_LOCALES: readonly Locale[] = ['pt-PT'];

const DICTIONARIES: Partial<Record<Locale, Messages>> = {
  'pt-PT': ptPT,
};

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? ptPT;
}

export const I18nContext = createContext<{ locale: Locale; t: Messages }>({ locale: 'pt-PT', t: ptPT });

export function useI18n() {
  return useContext(I18nContext);
}

export type { Messages };

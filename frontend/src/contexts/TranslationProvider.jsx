import { createContext, useContext, useMemo } from "react";
import i18n, { initI18n } from "../i18n";

const I18nContext = createContext(() => (key) => key);

export const TranslationProvider = ({ children, language }) => {
  // Initialised while deriving `t`, not in an effect afterwards.
  //
  // The effect version handed out `i18n.t` bound before `initI18n` had run,
  // so the entire first render translated every key to an empty string and a
  // second render replaced it. In a browser that is a frame of unlabelled
  // toolbar; under a test renderer it is simply what the labels are, which is
  // why asserting on any English text did not work.
  //
  // `initI18n` is idempotent -- it initialises once and changes language on
  // later calls -- so this costs nothing on re-render, and the translations
  // are bundled rather than fetched, so there is nothing to wait for.
  const t = useMemo(() => {
    initI18n(language);
    return i18n.t.bind(i18n);
  }, [language]);

  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => useContext(I18nContext);

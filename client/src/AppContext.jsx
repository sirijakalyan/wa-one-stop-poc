import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LangContext } from './i18n.js';
import { blankAnswers } from './questions.js';
import { blankCard } from './guideCard.js';
import { setApiLang } from './api.js';

// Holds the questionnaire in progress so it survives moving between screens.
const Ctx = createContext(null);

const LANG_KEY = 'wa-onestop-lang';
function savedLang() {
  try { const v = window.localStorage.getItem(LANG_KEY); return v === 'es' ? 'es' : 'en'; } catch { return 'en'; }
}

export function AppProvider({ children }) {
  // The language is a per-browser convenience. If storage is blocked it just starts in English.
  const [lang, setLangState] = useState(savedLang);
  const setLang = (l) => {
    const next = l === 'es' ? 'es' : 'en';
    setLangState(next);
    try { window.localStorage.setItem(LANG_KEY, next); } catch { /* storage blocked */ }
  };
  setApiLang(lang); // before any page asks the server for text
  useEffect(() => { try { document.documentElement.lang = lang; } catch { /* no document */ } }, [lang]);
  const langValue = useMemo(() => ({ lang, setLang }), [lang]);
  const [answers, setAnswers] = useState(blankAnswers());
  const [label, setLabel] = useState('');
  const [step, setStep] = useState(0);
  const [catsAuto, setCatsAuto] = useState(false);
  // The talking guide: its conversation and "Your business" card survive moving between screens (memory only, never stored).
  const [guide, setGuide] = useState({ messages: [], card: blankCard(), ask: null, awaiting: null, complete: false });
  const value = useMemo(
    () => ({ answers, setAnswers, label, setLabel, step, setStep, catsAuto, setCatsAuto, guide, setGuide }),
    [answers, label, step, catsAuto, guide]
  );
  return <LangContext.Provider value={langValue}><Ctx.Provider value={value}>{children}</Ctx.Provider></LangContext.Provider>;
}

export const useApp = () => useContext(Ctx);

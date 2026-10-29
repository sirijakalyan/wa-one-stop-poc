import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LangContext } from './i18n.js';
import { blankAnswers } from './questions.js';
import { blankCard } from './guideCard.js';
import { api, getSession, setApiLang, setSession } from './api.js';

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
  // What the guide is doing right now, so the top of the home page can show it (speaking, listening, and the line being said).
  const [live, setLive] = useState({ speaking: false, listening: false, text: '', role: 'guide' });
  const [guide, setGuide] = useState({ messages: [], card: blankCard(), ask: null, awaiting: null, complete: false });
  // The signed-in account (null when signed out). Signed-out visitors can still use the guide.
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(() => !getSession());
  useEffect(() => {
    if (!getSession()) return undefined;
    let live = true;
    api.me().then((r) => { if (live) setUser(r.user); if (live && !r.user) setSession(''); }).catch(() => {}).finally(() => { if (live) setAuthReady(true); });
    return () => { live = false; };
  }, []);
  const signIn = (u, token) => { setSession(token); setUser(u); };
  const signOut = async () => {
    try { await api.logout(); } catch { /* the token is dropped here either way */ }
    setSession('');
    setUser(null);
    // Nothing from this person's session stays on screen for the next one.
    setAnswers(blankAnswers()); setLabel(''); setStep(0); setCatsAuto(false);
    setGuide({ messages: [], card: blankCard(), ask: null, awaiting: null, complete: false });
  };
  const value = useMemo(
    () => ({ user, authReady, signIn, signOut, answers, setAnswers, label, setLabel, step, setStep, catsAuto, setCatsAuto, guide, setGuide, live, setLive }),
    [user, authReady, answers, label, step, catsAuto, guide, live]
  );
  return <LangContext.Provider value={langValue}><Ctx.Provider value={value}>{children}</Ctx.Provider></LangContext.Provider>;
}

export const useApp = () => useContext(Ctx);

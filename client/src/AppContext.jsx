import { createContext, useContext, useMemo, useState } from 'react';
import { blankAnswers } from './questions.js';
import { blankCard } from './guideCard.js';

// Holds the questionnaire in progress so it survives moving between screens.
const Ctx = createContext(null);

export function AppProvider({ children }) {
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
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

import { createContext, useContext, useMemo, useState } from 'react';
import { blankAnswers } from './questions.js';

// Holds the questionnaire in progress so it survives moving between screens.
const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [answers, setAnswers] = useState(blankAnswers());
  const [label, setLabel] = useState('');
  const [step, setStep] = useState(0);
  const [catsAuto, setCatsAuto] = useState(false);
  const value = useMemo(
    () => ({ answers, setAnswers, label, setLabel, step, setStep, catsAuto, setCatsAuto }),
    [answers, label, step, catsAuto]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

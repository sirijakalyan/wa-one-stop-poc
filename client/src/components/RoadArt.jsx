import { useT } from '../i18n.js';

// The road to opening day: an invented mountain-road picture with the five steps of every plan.
// The picture is decoration. The steps are a real ordered list, so a screen reader hears them in order.
// The route draws itself and the steps pop in one after another; both switch off for people who prefer less motion.
const STEPS = [
  { key: 'roadArt.s1', left: 3, top: 79 },
  { key: 'roadArt.s2', left: 28, top: 61 },
  { key: 'roadArt.s3', left: 42, top: 42 },
  { key: 'roadArt.s4', left: 55, top: 27 },
];

export default function RoadArt() {
  const t = useT();
  return (
    <div className="trail-art" data-testid="trail-art">
      <svg className="trail-svg" aria-hidden="true" focusable="false" viewBox="0 0 600 560">
        <path d="M0 470 L90 380 L140 420 L240 300 L300 360 L350 330 L430 400 L520 340 L600 390 L600 560 L0 560 Z" fill="#183a63" />
        <path d="M240 300 L268 330 L252 328 L240 340 L228 326 L214 332 Z" fill="#e9f1f8" opacity=".8" />
        <g className="trail-cloud"><ellipse cx="470" cy="70" rx="48" ry="14" fill="#2a4d78" /><ellipse cx="500" cy="60" rx="30" ry="14" fill="#2a4d78" /></g>
        <path className="trail-route" d="M60 500 C 160 470, 120 400, 210 380 S 330 330, 300 270 S 380 190, 460 200 S 560 150, 540 70" fill="none" stroke="#f2c14e" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 12" />
      </svg>
      <ol className="trail-steps" aria-label={t('roadArt.label')}>
        {STEPS.map((s, i) => (
          <li key={s.key} className={`trail-step trail-s${i + 1}`} style={{ left: `${s.left}%`, top: `${s.top}%` }}>
            <span className="trail-num" aria-hidden="true">{i + 1}</span>
            <span className="trail-text">
              <strong>{t(`${s.key}.t`)}</strong>
              <span>{t(`${s.key}.d`)}</span>
            </span>
          </li>
        ))}
        <li className="trail-step trail-flag trail-s5">
          <svg className="trail-flag-svg" aria-hidden="true" focusable="false" width="44" height="52" viewBox="0 0 44 52"><path d="M8 4 V50" stroke="#fff" strokeWidth="3" strokeLinecap="round" /><path d="M10 6 H38 L31 15 L38 24 H10 Z" fill="#f2c14e" /></svg>
          <strong>{t('roadArt.open')}</strong>
        </li>
      </ol>
    </div>
  );
}

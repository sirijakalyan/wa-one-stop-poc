// The guide character: a friendly person and a robot, drawn as flat SVG shapes. It is an invented illustration, not a photo,
// voice clone or likeness of any real person. A wave and a blink are CSS animations that switch off for people who prefer less motion.
export default function GuideArt({ small = false }) {
  return (
    <svg
      className={`guide-art${small ? ' is-small' : ''}`}
      viewBox="0 0 320 240"
      role="img"
      aria-label="Illustration of a friendly person and a small robot waving hello"
    >
      <ellipse cx="160" cy="224" rx="132" ry="9" fill="rgba(7,26,51,.18)" />

      {/* Person */}
      <g className="art-person">
        <path d="M64 224v-62c0-22 18-38 40-38s40 16 40 38v62z" fill="#0c7c8a" />
        <path d="M86 128l18 22 18-22" fill="none" stroke="#d3edf0" strokeWidth="5" strokeLinejoin="round" />
        <rect x="94" y="104" width="20" height="26" rx="8" fill="#e4b08a" />
        <circle cx="104" cy="82" r="30" fill="#f1c4a1" />
        <path d="M72 80c-2-26 16-40 34-40 20 0 34 14 30 38-6-14-18-20-34-20-14 0-24 8-30 22z" fill="#2b2f4a" />
        <g className="art-blink">
          <circle cx="94" cy="86" r="3.2" fill="#1c2238" />
          <circle cx="116" cy="86" r="3.2" fill="#1c2238" />
        </g>
        <path d="M96 99c4 5 12 5 16 0" fill="none" stroke="#1c2238" strokeWidth="2.6" strokeLinecap="round" />
        {/* Waving arm */}
        <g className="art-wave">
          <path d="M142 150c14-6 24-22 24-40" fill="none" stroke="#0c7c8a" strokeWidth="16" strokeLinecap="round" />
          <circle cx="166" cy="104" r="10" fill="#f1c4a1" />
        </g>
      </g>

      {/* Robot */}
      <g className="art-robot">
        <line x1="236" y1="92" x2="236" y2="76" stroke="#123660" strokeWidth="4" strokeLinecap="round" />
        <circle cx="236" cy="72" r="6" fill="#ffd978" />
        <rect x="204" y="92" width="64" height="52" rx="16" fill="#eaf6f8" stroke="#123660" strokeWidth="4" />
        <g className="art-blink">
          <rect x="218" y="108" width="10" height="14" rx="5" fill="#0a2547" />
          <rect x="244" y="108" width="10" height="14" rx="5" fill="#0a2547" />
        </g>
        <path d="M222 132h28" stroke="#1596a6" strokeWidth="4" strokeLinecap="round" />
        <rect x="210" y="148" width="52" height="60" rx="14" fill="#123660" />
        <rect x="224" y="162" width="24" height="16" rx="4" fill="#1596a6" />
        <path d="M200 160c-10 4-14 14-12 22" fill="none" stroke="#123660" strokeWidth="9" strokeLinecap="round" />
        <path d="M272 160c10 4 14 14 12 22" fill="none" stroke="#123660" strokeWidth="9" strokeLinecap="round" />
        <rect x="216" y="206" width="14" height="14" rx="4" fill="#0a2547" />
        <rect x="242" y="206" width="14" height="14" rx="4" fill="#0a2547" />
      </g>
    </svg>
  );
}

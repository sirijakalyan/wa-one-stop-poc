import { useState } from 'react';
import Icon from './Icon.jsx';
import { useT } from '../i18n.js';

// "Start here": a bar docked to the bottom of the screen for a first-time visitor, so it is plain that they can simply type.
// The home page hides it once the guide's own box is on screen or a conversation has begun.
export default function StartBar({ onSend }) {
  const t = useT();
  const [text, setText] = useState('');
  function submit(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onSend(clean);
    setText('');
  }
  return (
    <form className="start-bar" onSubmit={submit} aria-label={t('start.aria')}>
      <div className="start-bar-in">
        <label className="start-bar-label" htmlFor="start-bar-input">
          <strong>{t('start.label')}</strong>
          <span>{t('start.sub')}</span>
        </label>
        <input
          id="start-bar-input"
          type="text"
          maxLength={300}
          autoComplete="off"
          placeholder={t('start.placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          <Icon name="arrow" size={18} />{t('start.send')}
        </button>
      </div>
    </form>
  );
}

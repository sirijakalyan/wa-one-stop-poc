import { useState } from 'react';
import { CATS, STRUCTURES, WA_COUNTIES, YN } from '../questions.js';
import { CARD_FIELDS, rowText, confirmedCount } from '../guideCard.js';
import { useT } from '../i18n.js';

// "Your business" card. A row turns green only when the owner confirms it. Tapping Edit lets them change it.
export default function BusinessCard({ card, onEdit, disabled }) {
  const [editing, setEditing] = useState('');
  const t = useT();
  const FIELD_LABELS = t.card.fields;
  const STATUS_TEXT = { confirmed: t('card.confirmed'), heard: t('card.heard') };
  const done = confirmedCount(card);
  return (
    <section className="biz-card" aria-labelledby="biz-title">
      <h2 id="biz-title">{t('card.title')} <span className="biz-count">{t('card.count', done, CARD_FIELDS.length)}</span></h2>
      <ul className="biz-rows">
        {CARD_FIELDS.map((f) => {
          const state = card.status[f] || 'empty';
          const text = rowText(card, f, t.lang);
          return (
            <li key={f} className={`biz-row is-${state}`}>
              <span className={`dot dot-${state}`} aria-hidden="true" />
              <div className="biz-main">
                <span className="biz-label">{FIELD_LABELS[f]}</span>
                {editing === f ? (
                  <Editor field={f} card={card} t={t} onCancel={() => setEditing('')} onSave={(value) => { setEditing(''); onEdit(f, value); }} />
                ) : (
                  <span className="biz-value">{text || <em>{state === 'confirmed' ? t('card.skipped') : t('card.notAsked')}</em>}</span>
                )}
              </div>
              <span className="biz-state">{STATUS_TEXT[state] || ''}</span>
              {editing !== f ? (
                <button type="button" className="linklike" disabled={disabled} onClick={() => setEditing(f)} aria-label={t('card.editField', FIELD_LABELS[f])}>{t('card.edit')}</button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Editor({ field, card, t, onSave, onCancel }) {
  const FIELD_LABELS = t.card.fields;
  const v = card.values;
  const [structure, setStructure] = useState(v.structure || '');
  const [cats, setCats] = useState(v.cats || []);
  const [desc, setDesc] = useState(v.desc || '');
  const [city, setCity] = useState(v.city || '');
  const [county, setCounty] = useState((v.county || '').replace(/\s+county$/i, ''));
  const [yn, setYn] = useState(v[field] || '');
  const id = `edit-${field}`;

  let body = null;
  let value = null;
  if (field === 'structure') {
    value = structure;
    body = (
      <select id={id} value={structure} onChange={(e) => setStructure(e.target.value)} aria-label={FIELD_LABELS[field]}>
        <option value="">{t('card.choose')}</option>
        {STRUCTURES.map((s) => <option key={s.v} value={s.v}>{t.card.structureOptions[s.v]}</option>)}
      </select>
    );
  } else if (field === 'activity') {
    value = { cats, desc };
    body = (
      <fieldset className="edit-set">
        <legend className="sr-only">{FIELD_LABELS[field]}</legend>
        <input type="text" value={desc} maxLength={120} onChange={(e) => setDesc(e.target.value)} aria-label={t('card.descAria')} placeholder={t('card.descPlaceholder')} />
        {CATS.map((c) => (
          <label key={c.v} className="check-line">
            <input type="checkbox" checked={cats.includes(c.v)} onChange={(e) => setCats(e.target.checked ? [...cats, c.v] : cats.filter((x) => x !== c.v))} />
            {t.card.cat[c.v]}
          </label>
        ))}
      </fieldset>
    );
  } else if (field === 'place') {
    value = { city, county };
    body = (
      <span className="edit-set">
        <input type="text" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} aria-label={t('card.city')} placeholder={t('card.city')} />
        <select value={county} onChange={(e) => setCounty(e.target.value)} aria-label="County">
          <option value="">{t('card.county')}</option>
          {WA_COUNTIES.map((c) => <option key={c} value={c}>{t('card.countySuffix', c)}</option>)}
        </select>
      </span>
    );
  } else {
    value = yn;
    body = (
      <select id={id} value={yn} onChange={(e) => setYn(e.target.value)} aria-label={FIELD_LABELS[field]}>
        <option value="">{t('card.choose')}</option>
        {YN.map((o) => <option key={o.v} value={o.v}>{t.card.yn[o.v]}</option>)}
      </select>
    );
  }
  const empty = (field === 'structure' || !['activity', 'place'].includes(field)) && !value;
  return (
    <span className="biz-edit">
      {body}
      <span className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={empty} onClick={() => onSave(value)}>{t('card.saveConfirm')}</button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onCancel}>{t('card.cancel')}</button>
      </span>
    </span>
  );
}

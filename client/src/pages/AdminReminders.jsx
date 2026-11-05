import { useCallback, useEffect, useState } from 'react';
import { api, useLoad } from '../api.js';
import { ErrorNote, Loading } from '../components/Parts.jsx';
import { useA } from '../adminText.js';
import Icon from '../components/Icon.jsx';

const PRESETS = [30, 14, 7, 1, 0];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6:00 AM to 8:00 PM
const SAMPLE = '2027-03-31';

// What "hour o'clock in this zone" is on the clock in Washington State (Pacific Time) today, for example 9:00 AM Eastern is 6:00 AM Pacific.
export function pacificHour(hour, zone, now = new Date()) {
  const parts = (instant, tz) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(instant).map((x) => [x.type, Number(x.value)]));
  const asUtc = (p) => Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
  const guess = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0);
  const offset = asUtc(parts(new Date(guess), zone)) - guess; // how far the zone's clock is ahead of UTC
  const instant = new Date(guess - offset);
  return parts(instant, 'America/Los_Angeles').hour % 24;
}

export const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
// The date that is `days` before a YYYY-MM-DD date, worked out in UTC so it never shifts with the viewer's time zone.
export function minusDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}
const sameDays = (x, y) => x.length === y.length && x.every((n, i) => n === y[i]);

// Admin: which days before a renewal an email goes out, and when in the day. Saved changes apply to every owner right away.
export default function AdminReminders() {
  const a = useA();
  const fetchIt = useCallback(() => api.reminderSettings(), []);
  const { data, error, loading, reload } = useLoad(fetchIt);
  const [days, setDays] = useState(null);
  const [hour, setHour] = useState(9);
  const [zone, setZone] = useState('America/Los_Angeles');
  const [custom, setCustom] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!data) return;
    setDays([...data.config.windows]);
    setHour(data.config.sendHour);
    setZone(data.config.timezone);
  }, [data]);

  if (loading && !data) return <Loading what={a('Loading email reminders', 'Cargando recordatorios por correo')} />;
  if (error && !data) return <ErrorNote message={error} />;
  if (!data || !days) return null;

  const saved = data.config;
  const sorted = [...days].sort((x, y) => y - x);
  const dirty = !sameDays(sorted, saved.windows) || hour !== saved.sendHour || zone !== saved.timezone;
  const options = [...new Set([...PRESETS, ...days])].sort((x, y) => y - x);
  const dayLabel = (n) => (n === 0 ? a('Same day', 'El mismo día') : n === 1 ? a('1 day away', 'Falta 1 día') : a(`${n} days away`, `Faltan ${n} días`));
  const fmt = (d) => d.toLocaleDateString(a.locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const fmtLong = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(a.locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const toggle = (n) => { setNote(''); setErr(''); setDays((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n])); };
  const hours = [...new Set([...HOURS, hour])].sort((x, y) => x - y);

  function addCustom(e) {
    e.preventDefault();
    const n = Number(custom);
    if (!Number.isInteger(n) || n < 0 || n > 365) { setErr(a('Enter a whole number of days from 0 to 365.', 'Escriba un número entero de días de 0 a 365.')); return; }
    setErr(''); setNote('');
    setDays((cur) => (cur.includes(n) ? cur : [...cur, n]));
    setCustom(''); setAdding(false);
  }
  async function save() {
    setBusy(true); setErr(''); setNote('');
    try {
      await api.saveReminderSettings({ windows: sorted, sendHour: hour, timezone: zone });
      setNote(a('Saved. Owners get reminders on this schedule from now on.', 'Guardado. Los propietarios recibirán recordatorios con este calendario desde ahora.'));
      reload();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function sendTest() {
    setBusy(true); setErr(''); setNote('');
    try { const r = await api.testReminderEmail(); setNote(r.message); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const last = data.history?.[0];
  const zoneLabel = data.zones.find((z) => z.id === zone)?.label || zone;

  return (
    <section className="rem" aria-labelledby="rem-title">
      <h1 id="rem-title" tabIndex={-1}>{a('Email reminder schedule', 'Calendario de recordatorios por correo')}</h1>
      <p className="lead">{a('Choose how many days before a renewal date an email is sent. Saved changes apply to every owner right away.', 'Elija cuántos días antes de una fecha de renovación se envía un correo. Los cambios guardados se aplican de inmediato a todos los propietarios.')}</p>

      <fieldset className="rem-days">
        <legend>{a('Send an email when the renewal is', 'Enviar un correo cuando la renovación esté a')}</legend>
        <div className="rem-chips">
          {options.map((n) => (
            <label key={n} className={`rem-chip${days.includes(n) ? ' is-on' : ''}`}>
              <input type="checkbox" checked={days.includes(n)} onChange={() => toggle(n)} />
              <span className="rem-box" aria-hidden="true">{days.includes(n) && <Icon name="check" size={14} />}</span>
              {dayLabel(n)}
            </label>
          ))}
          {adding ? (
            <form className="rem-add" onSubmit={addCustom} noValidate>
              <label className="sr-only" htmlFor="rem-custom">{a('Days before renewal', 'Días antes de la renovación')}</label>
              <input id="rem-custom" type="number" min="0" max="365" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={a('e.g. 60', 'p. ej. 60')} autoFocus />
              <button type="submit" className="btn btn-primary btn-sm">{a('Add', 'Agregar')}</button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setAdding(false); setCustom(''); }}>{a('Cancel', 'Cancelar')}</button>
            </form>
          ) : (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAdding(true)} disabled={days.length >= 8 && !adding}><Icon name="plus" size={16} /> {a('Add custom days', 'Agregar días')}</button>
          )}
        </div>
        {!days.length && <p className="rem-warn" role="alert">{a('Choose at least one day.', 'Elija al menos un día.')}</p>}
      </fieldset>

      <div className="rem-time">
        <label htmlFor="rem-hour"><strong>{a('Send time', 'Hora de envío')}</strong></label>
        <select id="rem-hour" value={hour} onChange={(e) => { setHour(Number(e.target.value)); setNote(''); }}>
          {hours.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
        <label className="sr-only" htmlFor="rem-zone">{a('Time zone', 'Zona horaria')}</label>
        <select id="rem-zone" value={zone} onChange={(e) => { setZone(e.target.value); setNote(''); }}>
          {data.zones.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
        <span className="hint">{a('Washington State uses Pacific Time. Days are counted on the calendar of the zone you pick here.', 'El estado de Washington usa la hora del Pacífico. Los días se cuentan con el calendario de la zona que elija aquí.')}</span>
        {zone !== 'America/Los_Angeles' && (
          <span className="hint rem-pacific" role="note">{a(`That is ${hourLabel(pacificHour(hour, zone))} in Washington (Pacific Time).`, `Eso es ${hourLabel(pacificHour(hour, zone))} en Washington (hora del Pacífico).`)}</span>
        )}
      </div>

      <div className="rem-preview" aria-live="polite">
        <p><strong>{a('Preview', 'Vista previa')}</strong> {a('with a sample renewal date of', 'con una fecha de renovación de ejemplo:')} <strong>{fmtLong(SAMPLE)}</strong> ({hourLabel(hour)}, {zoneLabel})</p>
        <ol className="rem-line">
          {sorted.map((n) => (
            <li key={n}><span className="rem-dot" aria-hidden="true" /><strong>{fmt(minusDays(SAMPLE, n))}</strong><span>{n === 0 ? a('same day', 'mismo día') : n === 1 ? a('1 day', '1 día') : a(`${n} days`, `${n} días`)}</span></li>
          ))}
          <li className="is-end"><span className="rem-dot" aria-hidden="true" /><strong>{fmt(new Date(`${SAMPLE}T00:00:00Z`))}</strong><span>{a('Renewal', 'Renovación')}</span></li>
        </ol>
        <p className="hint">{a('If a renewal is already inside a day when an owner saves it, one email goes out at once for the closest day passed. The same day is never sent twice.', 'Si una renovación ya está dentro de un día cuando el propietario la guarda, se envía un correo de inmediato por el día más cercano ya pasado. El mismo día nunca se envía dos veces.')}</p>
      </div>

      <div className="rem-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !dirty || !days.length}>{a('Save schedule', 'Guardar calendario')}</button>
        <button type="button" className="btn btn-quiet" onClick={sendTest} disabled={busy}>{a('Send me a test email', 'Enviarme un correo de prueba')}</button>
        <span className="hint">{a('The test goes to your admin address only.', 'La prueba se envía solo a su dirección de administración.')}</span>
      </div>
      <ErrorNote message={err} />
      {note && <p className="saved" role="status">{note}</p>}

      {last ? (
        <p className="hint rem-last">{a('Last changed by', 'Último cambio de')} {last.by} {a('on', 'el')} {new Date(last.at).toLocaleString(a.locale)}: {last.summary}.</p>
      ) : <p className="hint rem-last">{a('Not changed yet. These are the starting values.', 'Aún sin cambios. Estos son los valores iniciales.')}</p>}
      {data.history?.length > 1 && (
        <details className="rem-history">
          <summary>{a('Change history', 'Historial de cambios')}</summary>
          <ul>{data.history.map((h) => <li key={h.at}>{new Date(h.at).toLocaleString(a.locale)}, {h.by}: {h.summary}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

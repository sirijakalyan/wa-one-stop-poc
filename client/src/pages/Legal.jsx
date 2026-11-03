import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n.js';

// Plain-language Terms and Privacy pages. DRAFT: they describe what this demo does today and must be reviewed by a lawyer and the agency before real use.
const TERMS = [
  ['What this is', 'WA Business One-Stop-Shop is a helper for people starting a business in Washington State. It builds a checklist from written rules and official agency pages. It is a helpful guide, not legal, tax or financial advice.'],
  ['Check with the agency', 'Rules, fees and deadlines can change. Please confirm every requirement and date with the agency before you act. A step marked "Source checked" means a person read the agency page on that date. It is not an approval from the agency. "Pending verification" means it has not been checked yet.'],
  ['No agency connection', 'This app is not connected to any agency system. Your progress is self-reported, and the app does not file, apply or pay for anything for you.'],
  ['The AI guide', 'The guide listens and asks questions. Written rules, not the AI, decide what applies to your business. Answers outside the written rules are labeled general information and may be wrong. Do not rely on them as official advice.'],
  ['Your account', 'Keep your password private. Tell us if you think someone else used your account. You can stop using the app at any time.'],
  ['Fair use', 'Please use the app for its intended purpose. Do not try to break it, overload it, or look at other people\'s information.'],
  ['No promises', 'The app is provided as is, without promises that it is complete, current or always available. It may change or be turned off.'],
];

const PRIVACY = [
  ['What we collect', 'The answers you give about your business (such as the business structure, the kind of business, city and county, and yes or no questions). If you create an account: your name, email address and a protected form of your password. If you turn on renewal reminders: the renewal dates you enter. We do not ask for street addresses, tax numbers or bank details.'],
  ['What is kept', 'The guide does not keep your conversation. Only a plan you choose to save is kept. Saved plans, notifications and settings are tied to your account, or to this browser if you are not signed in. We also keep a short activity log, such as "saved a plan" or "marked a step done", which an administrator can see.'],
  ['Who can see it', 'You can see your own information. Administrators of the app can see accounts, saved answers, checklist progress and activity so they can run and improve it. We do not sell your information.'],
  ['Questions you type', 'When you ask a question that the written rules do not cover, your question and the last few messages may be sent to an AI service to write a general answer. Do not type names, addresses, tax numbers or other personal details into the chat.'],
  ['Voice', 'If you use Talk, your browser\'s speech tools turn your voice into text. Depending on your browser, the audio may be processed by the browser\'s provider. Voice is off when you choose Type. You can mute the voice at any time.'],
  ['Email', 'If you turn on reminders, we email your account address before a renewal date you entered. Each email has a link to stop them. Stopping removes your address from reminders.'],
  ['This browser', 'The site stores a few things in your browser, such as an anonymous visitor ID, your sign-in session and an unsaved draft, so the app works between visits.'],
  ['Your choices', 'You can edit your answers, start over (which deletes your saved plan), stop email reminders, or ask for your account to be deleted. [Contact details to be added.]'],
  ['Changes', 'We may update this page. The date below shows when it last changed.'],
];

const TERMS_ES = [
  ['Qué es esto', 'WA Business One-Stop-Shop es un asistente para quienes empiezan un negocio en el estado de Washington. Crea una lista de pasos a partir de reglas escritas y páginas oficiales de las agencias. Es una guía útil, no asesoría legal, de impuestos ni financiera.'],
  ['Confirme con la agencia', 'Las reglas, tarifas y fechas límite pueden cambiar. Confirme cada requisito y cada fecha con la agencia antes de actuar. Un paso marcado como "Fuente revisada" significa que una persona leyó la página de la agencia en esa fecha. No es una aprobación de la agencia. "Verificación pendiente" significa que aún no se ha revisado.'],
  ['Sin conexión con la agencia', 'Esta aplicación no está conectada a ningún sistema de una agencia. Su avance lo informa usted mismo, y la aplicación no presenta, solicita ni paga nada por usted.'],
  ['La guía de IA', 'La guía escucha y hace preguntas. Las reglas escritas, no la IA, deciden qué se aplica a su negocio. Las respuestas fuera de las reglas escritas se marcan como información general y pueden ser incorrectas. No las use como asesoría oficial.'],
  ['Su cuenta', 'Mantenga su contraseña en privado. Avísenos si cree que otra persona usó su cuenta. Puede dejar de usar la aplicación en cualquier momento.'],
  ['Uso justo', 'Use la aplicación para su propósito previsto. No intente dañarla, sobrecargarla ni ver la información de otras personas.'],
  ['Sin garantías', 'La aplicación se ofrece tal como está, sin garantía de que esté completa, actualizada o siempre disponible. Puede cambiar o dejar de funcionar.'],
];

const PRIVACY_ES = [
  ['Qué recopilamos', 'Las respuestas que da sobre su negocio (como el tipo de empresa, el tipo de negocio, la ciudad y el condado, y preguntas de sí o no). Si crea una cuenta: su nombre, su correo electrónico y una forma protegida de su contraseña. Si activa los recordatorios de renovación: las fechas de renovación que ingrese. No pedimos direcciones, números de impuestos ni datos bancarios.'],
  ['Qué se conserva', 'La guía no conserva su conversación. Solo se conserva el plan que usted decide guardar. Los planes guardados, las notificaciones y la configuración están vinculados a su cuenta, o a este navegador si no ha iniciado sesión. También guardamos un breve registro de actividad, como "guardó un plan" o "marcó un paso como hecho", que un administrador puede ver.'],
  ['Quién puede verlo', 'Usted puede ver su propia información. Los administradores de la aplicación pueden ver las cuentas, las respuestas guardadas, el avance de la lista y la actividad para operar y mejorar la aplicación. No vendemos su información.'],
  ['Preguntas que escribe', 'Cuando hace una pregunta que las reglas escritas no cubren, su pregunta y los últimos mensajes pueden enviarse a un servicio de IA para redactar una respuesta general. No escriba nombres, direcciones, números de impuestos ni otros datos personales en el chat.'],
  ['Voz', 'Si usa Hablar, las herramientas de voz de su navegador convierten su voz en texto. Según el navegador, el proveedor del navegador puede procesar el audio. La voz está desactivada cuando elige Escribir. Puede silenciar la voz en cualquier momento.'],
  ['Correo electrónico', 'Si activa los recordatorios, le enviamos un correo a la dirección de su cuenta antes de una fecha de renovación que usted ingresó. Cada correo incluye un enlace para detenerlos. Al detenerlos, se quita su dirección de los recordatorios.'],
  ['Este navegador', 'El sitio guarda algunas cosas en su navegador, como un identificador anónimo de visitante, su sesión y un borrador sin guardar, para que la aplicación funcione entre visitas.'],
  ['Sus opciones', 'Puede editar sus respuestas, empezar de nuevo (lo cual elimina su plan guardado), detener los recordatorios por correo o pedir que se elimine su cuenta. [Los datos de contacto se agregarán.]'],
  ['Cambios', 'Podemos actualizar esta página. La fecha de abajo indica cuándo cambió por última vez.'],
];

export default function Legal({ kind }) {
  const t = useT();
  const terms = kind === 'terms';
  const spanish = t.lang === 'es';
  const rows = terms ? (spanish ? TERMS_ES : TERMS) : (spanish ? PRIVACY_ES : PRIVACY);
  const heading = terms ? t('legal.terms') : t('legal.privacy');
  // Each page gets its own tab title, so a screen reader and the browser history tell the two pages apart.
  useEffect(() => {
    const before = document.title;
    document.title = `${heading} | ${before}`;
    return () => { document.title = before; };
  }, [heading]);
  return (
    <div className="panel legal legal-full">
      <h1 tabIndex={-1}>{terms ? t('legal.terms') : t('legal.privacy')}</h1>
      <div>
        {rows.map(([h, p]) => (
          <section key={h}>
            <h2>{h}</h2>
            <p>{p}</p>
          </section>
        ))}
      </div>
      <p className="hint">{spanish ? 'Última actualización: 3 de noviembre de 2026.' : 'Last updated: November 3, 2026.'}</p>
      <p><Link to={terms ? '/privacy' : '/terms'}>{terms ? t('legal.privacy') : t('legal.terms')}</Link></p>
    </div>
  );
}

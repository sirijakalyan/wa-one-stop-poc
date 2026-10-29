// Interface text for the home page, the guide and the "Your business" card, in English and Spanish.
// The Spanish is a DRAFT. The build spec says a person (Olger Palma, whose recorded skills include Spanish) must review it, and
// nothing here says that review has happened. Agency rule text and the plan stay in English, and the screen says so.
import { createContext, useContext } from 'react';
import { pagesEn, pagesEs } from './i18nPages.js';

export const LANGS = [
  { code: 'en', label: 'English', short: 'EN', speech: 'en-US' },
  { code: 'es', label: 'Español', short: 'ES', speech: 'es-US' },
];

const en = {
  'lang.switchTo': 'Cambiar a español',
  'lang.name': 'English',
  'lang.button': 'Español',
  'nav./': 'Home',
  'nav./guide': 'AI guide',
  'nav./questionnaire': 'Questionnaire',
  'nav./checklist': 'My checklist',
  'nav./dashboard': 'Progress',
  'nav./notifications': 'Notifications',
  'nav./sources': 'Sources',
  'draft.note': '',
  // Home
  'home.greeting': "Hi, I'm here to help you start your Washington business. Tell me what you want to do, in your own words.",
  'home.title': 'Start your Washington business',
  'home.lead': 'Say what you want to build. The guide takes notes, you confirm each fact, and a plan to opening day builds in front of you.',
  'home.aiLabel': "You're talking to an AI guide",
  'home.ways': 'Choose how to start',
  'home.talk': 'Talk to me',
  'home.type': 'Type instead',
  'home.form': 'Use the step-by-step form',
  'home.waysNote': 'All three give you the same plan. You can switch at any time. No account or sign-in needed.',
  'home.sentenceLabel': 'Describe your business in one sentence',
  'home.sentencePlaceholder': 'I want to open a food truck in Spokane and hire two people',
  'home.sentenceGo': 'Start with this sentence',
  'home.privacy': 'We do not ask for names, addresses or tax numbers. The guide does not store your conversation. Only a plan you choose to save is kept, for this browser.',
  'home.samplesTitle': 'Or start from a sample business',
  'home.samplesHint': 'Each one starts the guide with a short story already told. These are made-up businesses.',
  'home.howTitle': 'How it works',
  'home.how1': 'Tell your story',
  'home.how1t': 'Say it or type it, or fill in the form. The guide takes notes in a card you can see and edit.',
  'home.how2': 'Confirm each fact',
  'home.how2t': 'Nothing goes on your plan until you say it is right. Written rules, not the AI, decide what applies.',
  'home.how3': 'See your road to opening day',
  'home.how3t': "Steps appear with the answer behind each one, and a timeline uses only the agencies' own published times.",
  'home.labelsSummary': 'How each step is labeled and where the information comes from',
  'home.l1': 'Applies to you', 'home.l1t': 'Your confirmed answers match a written rule, and its official source has been checked.',
  'home.l2': 'May apply, confirm', 'home.l2t': 'Your answers are unsure, so confirm with the agency.',
  'home.l3': 'Pending verification', 'home.l3t': 'Your answers point to this step, but the requirement is not confirmed yet.',
  'home.f1': 'Written rules decide.', 'home.f1t': 'The AI guide never decides what you legally need. It listens, asks and explains, and you confirm every fact.',
  'home.f2': 'Every item shows its source.', 'home.f2t': 'Each step links to the official page it came from and says whether the source has been checked.',
  'home.f3': 'We point you to the agency.', 'home.f3t': 'You apply with the Business Licensing Service and the Secretary of State. We do not apply for you.',
  'home.sources': 'See all sources',
  // Guide
  'guide.title': 'Your guide',
  'guide.ai': "You're talking to an AI guide. Written rules decide your plan; the guide only listens and asks.",
  'guide.useForm': 'Use the step-by-step form instead',
  'guide.sections': 'Guide sections',
  'guide.tabChat': 'Conversation',
  'guide.tabPlan': 'Plan',
  'guide.steps': (n) => `${n} steps`,
  'guide.log': 'Conversation with the guide',
  'guide.guide': 'Guide',
  'guide.you': 'You',
  'guide.notes': 'Taking notes...',
  'guide.quick': 'Quick answers',
  'guide.inputLabel': 'Tell the guide about your business, or answer its question',
  'guide.placeholder': 'Type here, for example: I want to open a food truck in Spokane',
  'guide.send': 'Send',
  'guide.micOn': 'Microphone on. Tap to turn it off.',
  'guide.micOff': 'Microphone off. Tap to talk.',
  'guide.mute': 'Mute voice',
  'guide.unmute': 'Unmute voice',
  'guide.stop': 'Stop',
  'guide.sideLabel': 'Your business and your plan',
  'guide.save': 'Save my plan and open my checklist',
  'guide.saveHint': 'Saves your confirmed answers for this browser. You can mark steps done on the checklist, which is simulated tracking.',
  'guide.checklistHint': 'Need the full checklist later?',
  'guide.checklistLink': 'Open My business',
  'guide.checklistAfter': 'after you save your plan.',
  'guide.edited': (label) => `I changed "${label}".`,
  'voice.listening': 'Listening. Speak now.',
  'voice.speaking': 'The guide is speaking.',
  'voice.cannotSpeak': 'This browser cannot speak. Captions and typing still work.',
  'voice.on': 'Voice is on. Tap the microphone to talk.',
  'voice.off': 'Voice is off. Tap the microphone or Unmute voice.',
  'voice.cannotListen': 'This browser cannot listen. Use Chrome or Edge, or type your answer.',
  'voice.noEs': 'This device has no Spanish voice installed, so the guide cannot speak Spanish here. The text still shows on screen. Chrome on Windows, Mac or Android usually has one. Check your system speech settings.',
  'voice.silent': 'No sound came out. Check your computer volume and that this browser tab is not muted, then tap Mute voice and Unmute voice.',
  'voice.noMic': 'No microphone was found.',
  // Card
  'card.title': 'Your business',
  'card.count': (n, total) => `${n} of ${total} confirmed`,
  'card.confirmed': 'Confirmed',
  'card.heard': 'Heard, please confirm',
  'card.notAsked': 'Not asked yet',
  'card.skipped': 'Skipped',
  'card.edit': 'Edit',
  'card.editField': (label) => `Edit ${label}`,
  'card.choose': 'Choose one',
  'card.descAria': 'What you do, in your words',
  'card.descPlaceholder': 'For example, a food truck',
  'card.city': 'City',
  'card.county': 'County (optional)',
  'card.countySuffix': (c) => `${c} County`,
  'card.saveConfirm': 'Save and confirm',
  'card.cancel': 'Cancel',
  'card.person': 'person',
  'card.people': 'people',
  // Menu
  'menu.open': 'Menu',
  'menu.close': 'Close',
  'plan.englishNote': '',
};

const es = {
  'lang.switchTo': 'Switch to English',
  'lang.name': 'Español',
  'lang.button': 'English',
  'nav./': 'Inicio',
  'nav./guide': 'Guía con IA',
  'nav./questionnaire': 'Cuestionario',
  'nav./checklist': 'Mi lista',
  'nav./dashboard': 'Progreso',
  'nav./notifications': 'Avisos',
  'nav./sources': 'Fuentes',
  'draft.note': 'Traducción preliminar al español, pendiente de revisión por una persona. El plan, las reglas y los textos de las agencias siguen en inglés por ahora.',
  'home.greeting': 'Hola, estoy aquí para ayudarle a iniciar su negocio en Washington. Cuénteme qué quiere hacer, con sus propias palabras.',
  'home.title': 'Inicie su negocio en Washington',
  'home.lead': 'Diga lo que quiere crear. La guía toma notas, usted confirma cada dato y frente a usted se arma un plan hasta el día de apertura.',
  'home.aiLabel': 'Está hablando con una guía de inteligencia artificial',
  'home.ways': 'Elija cómo empezar',
  'home.talk': 'Hablar con la guía',
  'home.type': 'Escribir',
  'home.form': 'Usar el formulario paso a paso',
  'home.waysNote': 'Los tres le dan el mismo plan. Puede cambiar en cualquier momento. No necesita cuenta ni inicio de sesión.',
  'home.sentenceLabel': 'Describa su negocio en una frase',
  'home.sentencePlaceholder': 'Quiero abrir un camión de comida en Spokane y contratar a dos personas',
  'home.sentenceGo': 'Empezar con esta frase',
  'home.privacy': 'No pedimos nombres, direcciones ni números de impuestos. La guía no guarda su conversación. Solo se conserva un plan que usted decida guardar, en este navegador.',
  'home.samplesTitle': 'O empiece con un negocio de ejemplo',
  'home.samplesHint': 'Cada uno inicia la guía con una breve historia ya contada. Son negocios inventados.',
  'home.howTitle': 'Cómo funciona',
  'home.how1': 'Cuente su historia',
  'home.how1t': 'Dígala o escríbala, o llene el formulario. La guía toma notas en una tarjeta que usted puede ver y editar.',
  'home.how2': 'Confirme cada dato',
  'home.how2t': 'Nada entra a su plan hasta que usted diga que es correcto. Reglas escritas, no la IA, deciden qué se aplica.',
  'home.how3': 'Vea su camino hasta el día de apertura',
  'home.how3t': 'Los pasos aparecen con la respuesta que los originó, y una línea de tiempo usa solo los tiempos que las agencias publican.',
  'home.labelsSummary': 'Cómo se etiqueta cada paso y de dónde viene la información',
  'home.l1': 'Se aplica a usted', 'home.l1t': 'Sus respuestas confirmadas coinciden con una regla escrita, y su fuente oficial fue revisada.',
  'home.l2': 'Puede aplicar, confirme', 'home.l2t': 'Sus respuestas no son seguras, así que confirme con la agencia.',
  'home.l3': 'Pendiente de verificación', 'home.l3t': 'Sus respuestas apuntan a este paso, pero el requisito aún no está confirmado.',
  'home.f1': 'Deciden las reglas escritas.', 'home.f1t': 'La guía de IA nunca decide lo que usted necesita legalmente. Escucha, pregunta y explica, y usted confirma cada dato.',
  'home.f2': 'Cada paso muestra su fuente.', 'home.f2t': 'Cada paso enlaza a la página oficial de donde salió y dice si la fuente fue revisada.',
  'home.f3': 'Le indicamos la agencia.', 'home.f3t': 'Usted presenta su solicitud ante el Servicio de Licencias de Negocios y el Secretario de Estado. Nosotros no la presentamos por usted.',
  'home.sources': 'Ver todas las fuentes',
  'guide.title': 'Su guía',
  'guide.ai': 'Está hablando con una guía de IA. Las reglas escritas deciden su plan; la guía solo escucha y pregunta.',
  'guide.useForm': 'Usar el formulario paso a paso',
  'guide.sections': 'Secciones de la guía',
  'guide.tabChat': 'Conversación',
  'guide.tabPlan': 'Plan',
  'guide.steps': (n) => `${n} pasos`,
  'guide.log': 'Conversación con la guía',
  'guide.guide': 'Guía',
  'guide.you': 'Usted',
  'guide.notes': 'Tomando notas...',
  'guide.quick': 'Respuestas rápidas',
  'guide.inputLabel': 'Cuéntele a la guía sobre su negocio, o responda su pregunta',
  'guide.placeholder': 'Escriba aquí, por ejemplo: Quiero abrir un camión de comida en Spokane',
  'guide.send': 'Enviar',
  'guide.micOn': 'Micrófono encendido. Toque para apagarlo.',
  'guide.micOff': 'Micrófono apagado. Toque para hablar.',
  'guide.mute': 'Silenciar voz',
  'guide.unmute': 'Activar voz',
  'guide.stop': 'Detener',
  'guide.sideLabel': 'Su negocio y su plan',
  'guide.save': 'Guardar mi plan y abrir mi lista',
  'guide.saveHint': 'Guarda sus respuestas confirmadas en este navegador. Puede marcar pasos como hechos en la lista, que es un seguimiento simulado.',
  'guide.checklistHint': '¿Necesita la lista completa más tarde?',
  'guide.checklistLink': 'Abrir Mi negocio',
  'guide.checklistAfter': 'después de guardar su plan.',
  'guide.edited': (label) => `Cambié "${label}".`,
  'voice.listening': 'Escuchando. Hable ahora.',
  'voice.speaking': 'La guía está hablando.',
  'voice.cannotSpeak': 'Este navegador no puede hablar. Los subtítulos y escribir siguen funcionando.',
  'voice.on': 'La voz está activada. Toque el micrófono para hablar.',
  'voice.off': 'La voz está apagada. Toque el micrófono o Activar voz.',
  'voice.cannotListen': 'Este navegador no puede escuchar. Use Chrome o Edge, o escriba su respuesta.',
  'voice.noEs': 'Este dispositivo no tiene una voz en español instalada, así que la guía no puede hablar en español aquí. El texto sí aparece en pantalla. Chrome en Windows, Mac o Android suele tener una. Revise la configuración de voz del sistema.',
  'voice.silent': 'No salió sonido. Revise el volumen de su computadora y que esta pestaña no esté silenciada, y luego toque Silenciar voz y Activar voz.',
  'voice.noMic': 'No se encontró ningún micrófono.',
  'card.title': 'Su negocio',
  'card.count': (n, total) => `${n} de ${total} confirmados`,
  'card.confirmed': 'Confirmado',
  'card.heard': 'Entendido, confirme',
  'card.notAsked': 'Aún no se pregunta',
  'card.skipped': 'Omitido',
  'card.edit': 'Editar',
  'card.editField': (label) => `Editar ${label}`,
  'card.choose': 'Elija uno',
  'card.descAria': 'A qué se dedica, con sus palabras',
  'card.descPlaceholder': 'Por ejemplo, un camión de comida',
  'card.city': 'Ciudad',
  'card.county': 'Condado (opcional)',
  'card.countySuffix': (c) => `Condado de ${c}`,
  'card.saveConfirm': 'Guardar y confirmar',
  'card.cancel': 'Cancelar',
  'card.person': 'persona',
  'card.people': 'personas',
  'menu.open': 'Menú',
  'menu.close': 'Cerrar',
};

const TABLE = { en: { ...en, ...pagesEn }, es: { ...es, ...pagesEs } };

// Card wording, per language.
export const CARD_TEXT = {
  en: {
    fields: { structure: 'Business structure', activity: 'What you do', place: 'City and county', hiring: 'Hiring within 90 days', subs: 'Subcontractors', salestax: 'Collects sales tax', income: 'Gross income $12,000 or more', tradename: 'Uses a business name' },
    structure: { sole: 'Sole proprietor', llc: 'LLC', corp: 'Corporation', partnership: 'Partnership or LLP', unsure: 'Structure not sure yet' },
    structureOptions: { sole: 'Sole proprietor', llc: 'Limited liability company (LLC)', corp: 'Corporation', partnership: 'Partnership or LLP', unsure: 'Not sure yet' },
    cat: { food: 'Food service', construction: 'Construction contracting', other: 'Other service or retail' },
    yn: { yes: 'Yes', no: 'No', unsure: 'Not sure' },
  },
  es: {
    fields: { structure: 'Estructura del negocio', activity: 'A qué se dedica', place: 'Ciudad y condado', hiring: 'Contratar en 90 días', subs: 'Subcontratistas', salestax: 'Cobra impuesto sobre las ventas', income: 'Ingresos brutos de $12,000 o más', tradename: 'Usa un nombre comercial' },
    structure: { sole: 'Propietario único', llc: 'LLC', corp: 'Corporación', partnership: 'Sociedad o LLP', unsure: 'Estructura aún no definida' },
    structureOptions: { sole: 'Propietario único', llc: 'Sociedad de responsabilidad limitada (LLC)', corp: 'Corporación', partnership: 'Sociedad o LLP', unsure: 'Aún no estoy seguro' },
    cat: { food: 'Servicio de comida', construction: 'Construcción y contratistas', other: 'Otro servicio o comercio' },
    yn: { yes: 'Sí', no: 'No', unsure: 'No estoy seguro' },
  },
};

// The three sample businesses, in the guide's own words, so choosing one starts the conversation in the chosen language.
export const SAMPLES_ES = {
  home: { title: 'Negocio de servicios desde casa', blurb: 'Un propietario único sin empleados. Muestra que se omite el paso del Secretario de Estado.', story: 'Hago servicio de limpieza y organización de casas. Trabajo yo solo desde mi casa y uso mi propio nombre.' },
  restaurant: { title: 'Restaurante', blurb: 'Una LLC con empleados. Muestra el orden de los pasos, la contratación y un recordatorio del permiso de salud del condado.', story: 'Somos una LLC y queremos abrir un restaurante en Bellevue. Vamos a contratar a un equipo de ocho personas y vamos a vender comida y bebidas.' },
  contractor: { title: 'Contratista de construcción', blurb: 'Un propietario único con empleados y subcontratistas. Muestra una credencial que la licencia comercial no cubre.', story: 'Soy propietario único y hago remodelaciones y estructuras. Voy a contratar a dos personas y también voy a usar subcontratistas.' },
};

export const LangContext = createContext({ lang: 'en', setLang: () => {} });
export const useLang = () => useContext(LangContext);

export function useT() {
  const { lang } = useContext(LangContext);
  const table = TABLE[lang] || TABLE.en;
  const t = (key, ...args) => {
    const v = table[key] ?? TABLE.en[key] ?? key;
    return typeof v === 'function' ? v(...args) : v;
  };
  t.lang = lang;
  t.card = CARD_TEXT[lang] || CARD_TEXT.en;
  t.countyLabel = (county) => {
    const name = String(county || '').trim().replace(/\s+county$/i, '').trim();
    if (!name) return '';
    return lang === 'es' ? `Condado de ${name}` : `${name} County`;
  };
  return t;
}

export const dateLocale = (lang) => (lang === 'es' ? 'es-US' : 'en-US');
export const speechLang = (lang) => (LANGS.find((l) => l.code === lang) || LANGS[0]).speech;

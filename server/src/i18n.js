// Languages for the guide. English is the source text. Spanish is a DRAFT: the build spec says a person (Olger Palma, whose recorded
// skills include Spanish) must review it before anyone calls it reviewed. Nothing here claims that review has happened.
// No Node imports, so this also runs in the in-page preview.

export const LANGS = ['en', 'es'];
export const cleanLang = (l) => (LANGS.includes(l) ? l : 'en');

export const ES = {
  fieldLabels: {
    structure: 'Estructura del negocio',
    activity: 'A qué se dedica',
    place: 'Ciudad y condado',
    hiring: 'Contratar en 90 días',
    subs: 'Subcontratistas',
    salestax: 'Cobra impuesto sobre las ventas',
    income: 'Ingresos brutos de $12,000 o más',
    tradename: 'Usa un nombre comercial',
  },
  structure: { sole: 'Propietario único', llc: 'LLC', corp: 'Corporación', partnership: 'Sociedad o LLP', unsure: 'Estructura aún no definida' },
  category: { food: 'Servicio de comida', construction: 'Construcción y contratistas', other: 'Otro servicio o comercio' },
  yn: { yes: 'Sí', no: 'No', unsure: 'No estoy seguro' },
  county: (name) => `Condado de ${name}`,
  asks: {
    structure: {
      question: '¿Cómo estará organizado su negocio? Si no está seguro, no hay problema.',
      chips: [['sole', 'Propietario único'], ['llc', 'LLC'], ['corp', 'Corporación'], ['partnership', 'Sociedad o LLP'], ['unsure', 'No estoy seguro']],
    },
    activity: {
      question: '¿Qué tipo de negocio es?',
      chips: [['food', 'Servicio de comida'], ['construction', 'Construcción y contratistas'], ['other', 'Otro servicio o comercio']],
    },
    place: { question: '¿En qué ciudad trabajará? Yo completaré el condado. Puede omitir esto.', chips: [['skip', 'Omitir por ahora']] },
    hiring: { question: '¿Va a contratar a alguien en los próximos 90 días?' },
    subs: { question: '¿Va a pagar a subcontratistas o contratistas independientes para que trabajen para usted?' },
    salestax: { question: '¿Va a vender productos o servicios que requieran cobrar impuesto sobre las ventas?' },
    income: { question: '¿Espera tener ingresos brutos de $12,000 al año o más?' },
    tradename: { question: '¿Hará negocios con un nombre distinto de su nombre legal completo?' },
  },
  readback: {
    heard: 'Entendí',
    right: '¿Es correcto?',
    hiring: { yes: (n) => `contratará${n ? ` a ${n} ${n === 1 ? 'persona' : 'personas'}` : ''} dentro de 90 días`, no: 'no contratará en 90 días', unsure: 'no está seguro de contratar' },
    subs: { yes: 'usará subcontratistas', no: 'sin subcontratistas', unsure: 'no está seguro de los subcontratistas' },
    salestax: { yes: 'cobrará impuesto sobre las ventas', no: 'no cobrará impuesto sobre las ventas', unsure: 'no está seguro del impuesto sobre las ventas' },
    income: { yes: 'ingresos de $12,000 o más', no: 'ingresos menores de $12,000', unsure: 'no está seguro de los ingresos' },
    tradename: { yes: 'usará un nombre comercial', no: 'usará su propio nombre', unsure: 'no está seguro del nombre comercial' },
  },
  confirmChips: [{ value: 'confirm', label: 'Sí, es correcto' }, { value: 'change', label: 'Cambiar algo' }],
  saveChip: 'Guardar mi plan',
  ackGot: 'Entendido.',
  ackConfirmed: 'Gracias. Ya está en su tarjeta.',
  change: 'Está bien. Toque cualquier fila de su tarjeta para cambiarla, o dígame qué corregir.',
  complete: 'Eso es todo lo que necesito. Su plan y su camino hacia el día de apertura están listos a la derecha. Cada paso muestra la respuesta que lo originó. Diga o toque Guardar mi plan para conservarlo, o hágame una pregunta.',
  completeCard: 'Su tarjeta está completa.',
  noFacts: {
    place: 'No reconocí una ciudad de Washington. Dígala o escríbala otra vez, o toque Omitir por ahora.',
    asking: 'No entendí. Toque una de las respuestas o escríbala otra vez.',
    none: 'No identifiqué ningún dato del negocio. Dígame qué quiere iniciar, o responda la pregunta de abajo.',
  },
  special: ' Una cosa más: algunos negocios, como los que venden alcohol o cuidan niños, necesitan licencias especiales de otras agencias. Esta demostración no tiene reglas para eso, así que pregunte a la agencia.',
  // Answers that come from the English rules and guides get this lead-in, so nobody thinks the agency text was translated.
  englishNote: 'Esta respuesta viene de las reglas y guías oficiales, que por ahora están en inglés:',
  confused: 'No hay problema. Cuénteme, con sus propias palabras, qué tipo de negocio quiere iniciar, por ejemplo "un camión de comida en Spokane". O toque una de las respuestas de abajo. También puede usar el formulario paso a paso.',
  ai: 'Soy una guía de inteligencia artificial, no una persona. Tomo notas y explico los pasos con las reglas escritas de esta aplicación. Las reglas deciden qué se aplica a usted y usted confirma cada dato.',
  official: 'No. Esto es una demostración, no un sitio oficial del gobierno, y no es asesoría legal. Cada paso enlaza a la página de la agencia, así que confirme allí antes de presentar su solicitud.',
  otherState: 'Esta demostración cubre solamente el estado de Washington. No tengo reglas para otros estados. Consulte las agencias de negocios de ese estado.',
  outOfScope: 'Eso queda fuera de lo que cubre esta demostración. Solo uso las reglas y guías escritas de esta aplicación, y ninguna cubre ese tema. Pregunte a la agencia correspondiente o visite la página de Fuentes. Puedo ayudar con la licencia comercial, el registro con el Secretario de Estado, el registro de contratistas, la compensación para trabajadores, los impuestos de empleadores, el reporte de nuevos empleados y los permisos de salud del condado.',
  costTotal: 'No puedo dar un total. El Departamento de Ingresos dice que la tarifa de su solicitud de licencia varía y que cada endoso tiene su propia tarifa. Esta demostración no tiene montos verificados para los demás pasos, así que no voy a adivinar. Revise la página de cada agencia para ver su tarifa actual.',
  timeTotal: 'No puedo prometer una fecha de apertura. Los únicos tiempos registrados aquí son: el Departamento de Ingresos dice que las solicitudes de licencia en línea tardan unos 10 días hábiles, y el registro de contratistas por correo con L&I tarda de 3 a 4 semanas. Las agencias no publican el tiempo de los demás pasos. Su camino hacia el día de apertura muestra esto y marca todo lo demás como tiempo no publicado.',
  thanks: 'De nada. Pregúnteme sobre cualquier paso, sus tarifas o tiempos, o diga "¿cuál es mi siguiente paso?" cuando quiera.',
  greeting: 'Respondo preguntas sobre los pasos de esta lista, usando solo las reglas y guías de esta aplicación. Pregunte sobre una licencia, un registro, tarifas, tiempos o qué sigue.',
  noMatch: 'No tengo eso en las reglas y guías actuales. Pruebe preguntar sobre la licencia comercial, el registro con el Secretario de Estado, el registro de contratistas, la compensación para trabajadores, los impuestos de empleadores o el reporte de nuevos empleados, o visite la página de Fuentes.',
};

// Retrieval aid only: turns Spanish words in a question into the English words the rules and guides use, so the existing grounded
// helper can find the right record. It decides nothing. Longest phrases first.
const ES_TO_EN = [
  [/licencia (comercial|de negocio|de negocios|empresarial)/g, 'business license'],
  [/secretar[ií]a de estado|secretario de estado/g, 'secretary of state'],
  [/compensaci[oó]n (para|de) (los )?trabajadores|compensaci[oó]n laboral|seguro de trabajadores/g, 'workers compensation'],
  [/impuesto (sobre las |sobre |de )?ventas/g, 'sales tax'],
  [/impuestos? de empleadores?|impuestos? de desempleo/g, 'employer taxes unemployment'],
  [/permiso (de salud|sanitario)/g, 'health permit'],
  [/nombre comercial|nombre del negocio/g, 'trade name'],
  [/subcontratistas?|contratistas? independientes?/g, 'independent contractors subcontractors'],
  [/cu[aá]nto tiempo( tarda| toma| demora)?|cu[aá]nto tarda/g, 'how long does it take'],
  [/c[oó]mo (empiezo|empezar|inicio|iniciar|comienzo|comenzar)/g, 'how do i start'],
  [/(cu[aá]l es )?(el )?primer paso/g, 'first step'],
  [/qu[eé] (es|son)/g, 'what is'],
  [/cu[aá]nto (cuesta|cobran|es)|costo|precio|tarifa/g, 'fee cost'],
  [/registrar(me)?|registro/g, 'register'],
  [/contratista/g, 'contractor'],
  [/licencias?/g, 'license'],
  [/empleados?|trabajadores|personal/g, 'employees'],
  [/contratar/g, 'hire'],
  [/seguro/g, 'insurance'],
  [/impuestos?/g, 'tax'],
  [/permisos?/g, 'permit'],
  [/salud/g, 'health'],
  [/pasos?/g, 'steps'],
  [/ingresos?/g, 'income'],
  [/ciudad/g, 'city'],
  [/condado/g, 'county'],
  [/formulario/g, 'form'],
  [/negocio|empresa/g, 'business'],
  [/necesito|debo|tengo que/g, 'do i need'],
  [/c[oó]mo/g, 'how'],
];
export function esToEn(text) {
  let t = ` ${String(text || '').toLowerCase().replace(/[¿¡]/g, ' ')} `;
  for (const [rx, en] of ES_TO_EN) t = t.replace(rx, ` ${en} `);
  return t.replace(/\s+/g, ' ').trim();
}

// Spanish detection for questions and one-word answers (the owner chose Spanish, so these only need to cover Spanish phrasing).
export const ES_RX = {
  strictQuestion: /\?\s*$|^\s*[¿¡]|^\s*(?:(?:pues|bueno|oye|hola|entonces|y)[\s,]+)*(qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|por qu[eé]|cu[aá]nto|cu[aá]nta|cu[aá]nt[oa]s|cu[aá]l|cu[aá]les|puedo|necesito|debo|hay|es|son|tengo que|quiero saber)\b/i,
  midQuestion: /\b(puedo|necesito|debo|tengo que|cu[aá]nto|cu[aá]nto tiempo|c[oó]mo hago|me puede|me pueden|qu[eé] necesito|qu[eé] debo)\b/i,
  ai: /\b(eres|es usted|usted es|eres tú)\s+(una\s+)?(persona|humana?|robot|bot|ia|m[aá]quina)\b|\bhablo con (una )?(persona|humano|robot)\b/i,
  official: /\b(es|esto es|este sitio es)\b[^.?!]{0,20}\b(oficial|del gobierno|gubernamental|asesor[ií]a legal)\b|\bsitio oficial\b/i,
  otherState: /\b(oregon|oreg[oó]n|idaho|california|texas|nueva york|florida|alaska|nevada|montana|otros estados|otro estado|fuera de washington)\b/i,
  costTotal: /\bcu[aá]nto (me )?(va a |voy a )?(costar|cuesta|costar[aá]|cuestan|cobran)\b[^.?!]{0,25}\b(todo|esto|en total|total|empezar|iniciar)\b|\bcosto total\b|\bcu[aá]nto cuesta todo\b/i,
  timeTotal: /\bcu[aá]nto (tiempo|tardar[aá]|tarda|demora)\b[^.?!]{0,30}\b(para abrir|hasta abrir|antes de abrir|para empezar|todo)\b|\bcu[aá]ndo (puedo|podr[eé]) abrir\b|\bqu[eé] tan r[aá]pido\b/i,
  outOfScope: /\b(marcas? registradas?|patentes?|derechos de autor|copyright|visas?|inmigraci[oó]n|tarjeta verde|informe anual|clima|tiempo en seattle|acciones|inversi[oó]n|bancarrota|divorcio|demanda)\b/i,
  confused: /\b(estoy confundid[oa]|no entiendo|estoy perdid[oa]|no s[eé] qu[eé] hacer|ni idea)\b/i,
  thanks: /^\s*(gracias|muchas gracias|ok|okay|vale|listo|perfecto|excelente|genial|entendido)\b[\s!.]*$/i,
  greeting: /^\s*(hola|buenas|buenos d[ií]as|buenas tardes|ayuda|ay[uú]dame|qu[eé] puedes hacer|qui[eé]n eres|empezar|iniciar)\b[\s!.?]*$/i,
  save: /^\s*(?:(?:ok|okay|s[ií]|por favor|ahora|entonces|bueno)[\s,]+)*(?:guardar|guarda|guarde|conservar|conserva)\b|\b(?:guardar|guarda|guarde|conservar|abrir)\b[^.?!]{0,20}\b(?:plan|lista)\b/i,
  start: /\b(c[oó]mo (empiezo|empezar|inicio|iniciar|comienzo|comenzar)|quiero (empezar|iniciar|abrir|comenzar) un negocio|los pasos|primer paso|siguiente paso|qu[eé] (hago|debo hacer) (primero|ahora))\b/i,
};

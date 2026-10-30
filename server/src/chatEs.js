// Spanish for the side chat. The chat finds its answer in English (it matches words against the English rule records), then this
// file turns that answer into Spanish: the rule text through the Spanish rule records, and the sentences around it through the table below.
// The Spanish is a DRAFT that a person must review. Nothing here adds a fact; it only changes the language.

// "English text in the English record" -> "same text in the Spanish record", for every field the chat quotes.
export function ruleTextMap(enRules, esRules) {
  const map = new Map();
  // The chat sometimes quotes only one sentence of a longer text, so a text is also added sentence by sentence when both languages split the same way.
  const split = (t) => t.split(/(?<=[.!?])\s+(?=[A-Z"¿¡])/);
  const put = (en, es) => {
    if (typeof en !== 'string' || typeof es !== 'string' || en === es || en.length < 3) return;
    map.set(en, es);
    const a = split(en); const b = split(es);
    if (a.length > 1 && a.length === b.length) a.forEach((x, i) => { if (x !== b[i] && x.length >= 3) map.set(x, b[i]); });
  };
  const putList = (a, b) => { if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) a.forEach((x, i) => put(x, b[i])); };
  esRules.forEach((es, i) => {
    const en = enRules[i];
    if (!en || en.id !== es.id) return;
    put(en.title, es.title);
    put(en.agency, es.agency);
    put(en.detail, es.detail);
    put(en.supports, es.supports);
    put(en.limits, es.limits);
    put(en.fallback, es.fallback);
    put(en.noLink, es.noLink);
    put(en.noLinkCounty, es.noLinkCounty);
    put(en.apply?.label, es.apply?.label);
    put(en.source?.label, es.source?.label);
    put(en.verification?.note, es.verification?.note);
    const eg = en.guide || {}; const sg = es.guide || {};
    put(eg.meaning, sg.meaning);
    put(eg.prepareNote, sg.prepareNote);
    put(eg.pendingNote, sg.pendingNote);
    put(eg.whyExternal, sg.whyExternal);
    putList(eg.who, sg.who);
    putList(eg.conditions, sg.conditions);
    putList(eg.prepare, sg.prepare);
    if (Array.isArray(eg.steps) && Array.isArray(sg.steps) && eg.steps.length === sg.steps.length) eg.steps.forEach((s, k) => put(s.text, sg.steps[k].text));
    if (Array.isArray(eg.facts) && Array.isArray(sg.facts) && eg.facts.length === sg.facts.length) eg.facts.forEach((f, k) => { put(f.label, sg.facts[k].label); put(f.text, sg.facts[k].text); });
    for (const key of Object.keys(en.reason || {})) put(en.reason[key], es.reason?.[key]);
  });
  return map;
}

// Spanish chat questions for the things the chat answers by pattern (thanks, what can you do, next step, and so on).
// Each is turned into the English question the chat already understands. Anything else goes through the word list in i18n.js.
const INTENTS = [
  [/^\s*(gracias|muchas gracias|ok|okay|vale|listo|perfecto|excelente|genial|entendido)\b[\s!.]*$/i, 'thanks'],
  [/^\s*(adi[oó]s|hasta luego|eso es todo|nada m[aá]s|no gracias)\b/i, 'bye'],
  [/^\s*(hola|buenas|buenos d[ií]as|buenas tardes|ayuda|ay[uú]dame|empezar)\b[\s!.?]*$/i, 'hello'],
  [/qu[eé] (puedes|puede|sabes|sabe|haces|hace) (hacer)?|c[oó]mo (me )?(puedes|puede) ayudar|qui[eé]n eres|qu[eé] eres/i, 'what can you do'],
  [/cu[aá]nto (me )?(va a |voy a )?(costar|cuesta|costar[aá]|cuestan|cobran)\b[^.?!]{0,25}\b(todo|esto|en total|total|empezar|iniciar)\b|costo total|cu[aá]nto cuesta todo/i, 'how much will everything cost in total'],
  [/cu[aá]nto (tiempo|tardar[aá]|tarda|demora)\b[^.?!]{0,30}\b(para abrir|hasta abrir|antes de abrir|para empezar|todo)\b|cu[aá]ndo (puedo|podr[eé]) abrir|qu[eé] tan r[aá]pido/i, 'how long until i can open'],
  [/siguiente paso|qu[eé] sigue|qu[eé] hago ahora|qu[eé] hago despu[eé]s|qu[eé] viene despu[eé]s/i, 'what is my next step'],
  [/pendiente|sin verificar|falta verificar/i, 'what is still pending'],
  [/lista completa|todos los pasos|mostrar mi lista|ver mi lista/i, 'show my full checklist'],
  [/(puedes|puede|pueden) (enviar|presentar|llenar|pagar|hacer)(lo|la|los|las)?\b[^.?!]{0,30}\b(por m[ií]|por nosotros)|hazlo por m[ií]/i, 'can you submit it for me'],
  [/garantiz|me garantiza|est[aá] garantizado/i, 'can you guarantee this'],
];
export function esChatToEn(message, fallback) {
  const m = String(message || '');
  for (const [rx, en] of INTENTS) if (rx.test(m)) return en;
  return fallback(m);
}

// Sentences the chat writes itself. Longest and most specific first. Anything not listed stays as it is.
const PHRASES = [
  // fees, timing, scope
  [/I can't give a total\. DOR says its license application fee varies and each endorsement has its own fee, and DOR explains how to work out the fee\. This demo has no verified fee amounts for the other steps, so I won't guess\. Check each step's agency page for its current fee\./g, 'No puedo dar un total. El DOR indica que la tarifa de la solicitud de licencia varía y que cada endoso tiene su propia tarifa, y explica cómo calcularla. Aquí no hay montos de tarifas verificados para los demás pasos, así que no voy a adivinar. Revise la página de la agencia de cada paso para ver su tarifa actual.'],
  [/I can't promise an opening date\. The only times recorded here are: DOR says online business license applications take about 10 business days, and L&I contractor registration by mail takes 3 to 4 weeks\. The agencies do not publish a time for the other steps\. Your road to opening day shows these, and marks everything else as time not published\./g, 'No puedo prometer una fecha de apertura. Los únicos tiempos registrados aquí son: el DOR indica que las solicitudes de licencia comercial en línea tardan unos 10 días hábiles, y que el registro de contratistas de L&I por correo tarda de 3 a 4 semanas. Las agencias no publican el tiempo de los demás pasos. Su camino al día de apertura muestra estos tiempos y marca todo lo demás como tiempo no publicado.'],
  [/This demo covers Washington State only\. I have no rules for other states\. Please check with that state's own business agencies\./g, 'Esto cubre solo el estado de Washington. No tengo reglas para otros estados. Consulte con las agencias de negocios de ese estado.'],
  [/That is outside what this demo covers\. I only use the written rules and guides in this app, and none of them cover that topic\. Please ask the relevant agency, or try the Sources page\. I can help with the business license, Secretary of State filing, contractor registration, workers' compensation, employer taxes, new hire reporting and county health permits\./g, 'Eso queda fuera de lo que cubre esta aplicación. Solo uso las reglas y guías escritas aquí, y ninguna cubre ese tema. Pregunte a la agencia correspondiente o visite la página de Fuentes. Puedo ayudar con la licencia comercial, el registro ante el Secretario de Estado, el registro de contratistas, la compensación para trabajadores, los impuestos de empleadores, el reporte de nuevas contrataciones y los permisos de salud del condado.'],
  [/I don't have that in the current rules\/guides\. Try asking about (.+?), or check the Sources page\./g, (m, list) => `No tengo eso en las reglas y guías actuales. Pruebe preguntar sobre ${list.replace(/business license/g, 'la licencia comercial').replace(/Secretary of State filing/g, 'el registro ante el Secretario de Estado').replace(/contractor registration/g, 'el registro de contratistas').replace(/workers' compensation/g, 'la compensación para trabajadores').replace(/employer taxes/g, 'los impuestos de empleadores').replace(/new hire reporting/g, 'el reporte de nuevas contrataciones').replace(/county health permit/g, 'el permiso de salud del condado')}, o visite la página de Fuentes.`],
  [/No business is selected yet, so I can't personalize your steps\. Choose a sample business or complete the questionnaire to get a checklist for your business\. I can still answer general questions about any step\./g, 'Aún no hay un negocio seleccionado, así que no puedo personalizar sus pasos. Elija un negocio de muestra o complete el cuestionario para obtener una lista para su negocio. Aun así puedo responder preguntas generales sobre cualquier paso.'],
  [/Your checklist has (\d+) steps\. (\d+) marked done \(simulated tracking\)\./g, 'Su lista tiene $1 pasos. $2 marcados como hechos (seguimiento simulado).'],
  [/A good way to begin, in the order this app uses:/g, 'Una buena forma de empezar, en el orden que usa esta aplicación:'],
  [/Other steps depend on your business: /g, 'Otros pasos dependen de su negocio: '],
  [/You already have a checklist\. Ask "what is my next step\?" to see where you are\./g, 'Ya tiene una lista. Pregunte "¿cuál es mi siguiente paso?" para ver dónde está.'],
  [/Not every step applies to every business\. Choose a sample business or complete the questionnaire to get your own checklist\./g, 'No todos los pasos aplican a todos los negocios. Elija un negocio de muestra o complete el cuestionario para obtener su propia lista.'],
  [/Each step is Source checked with a date or Pending verification\. Confirm with the agency\./g, 'Cada paso tiene Fuente revisada con una fecha o Verificación pendiente. Confirme con la agencia.'],
  [/"(.+?)" is not on your checklist based on your answers, so here is your next open step\./g, '"$1" no está en su lista según sus respuestas, así que este es su siguiente paso pendiente.'],
  [/"(.+?)" is the last step on your checklist, so nothing comes after it\./g, '"$1" es el último paso de su lista, así que no hay nada después.'],
  [/Every step after "(.+?)" is already marked done \(simulated tracking\)\./g, 'Todos los pasos después de "$1" ya están marcados como hechos (seguimiento simulado).'],
  [/No steps are left open on your checklist \(done marks are simulated tracking\)\./g, 'No queda ningún paso pendiente en su lista (las marcas de hecho son seguimiento simulado).'],
  [/Still open earlier on your list: /g, 'Aún pendientes antes en su lista: '],
  [/Confirm each requirement with its agency\./g, 'Confirme cada requisito con su agencia.'],
  [/After "(.+?)"( \(marked done\))?, your next step is:/g, (m, t, d) => `Después de "${t}"${d ? ' (marcado como hecho)' : ''}, su siguiente paso es:`],
  [/Next step: (.+?)\. \((.+?)\)$/gm, 'Siguiente paso: $1. ($2)'],
  [/Next step: /g, 'Siguiente paso: '],
  [/There is no verified link for this step in the current rules\./g, 'No hay un enlace verificado para este paso en las reglas actuales.'],
  [/Ask "show my full checklist" to see every step\./g, 'Pida "mostrar mi lista completa" para ver todos los pasos.'],
  [/After that: /g, 'Después de eso: '],
  [/"(.+?)" is the last step in this app's general order, so nothing comes after it\. Choose a sample business or complete the questionnaire to see which steps apply to your business\./g, '"$1" es el último paso en el orden general de esta aplicación, así que no hay nada después. Elija un negocio de muestra o complete el cuestionario para ver qué pasos aplican a su negocio.'],
  [/After "(.+?)", the usual next step is:/g, 'Después de "$1", el siguiente paso habitual es:'],
  [/Next in order: (.+?)\. \((.+?)\)/g, 'Siguiente en orden: $1. ($2)'],
  [/This is the general order\. Choose a sample business or complete the questionnaire to see which steps apply to your business\./g, 'Este es el orden general. Elija un negocio de muestra o complete el cuestionario para ver qué pasos aplican a su negocio.'],
  [/Let's go through "(.+?)" one step at a time\. I can't fill in or submit anything for you\. You do that on the agency's own site\./g, 'Repasemos "$1" un paso a la vez. No puedo llenar ni enviar nada por usted. Eso lo hace en el sitio de la propia agencia.'],
  [/Have ready: /g, 'Tenga listo: '],
  [/Step (\d+) of (\d+) \((.+?)\): /g, 'Paso $1 de $2 ($3): '],
  [/Say "next" when you are ready for step (\d+)\./g, 'Diga "siguiente" cuando esté listo para el paso $1.'],
  [/That is the last step\. Confirm everything with the agency\./g, 'Ese es el último paso. Confirme todo con la agencia.'],
  [/Which one do you mean: (.+?)\? Pick one and I will guide you one step at a time\./g, (m, n) => `¿A cuál se refiere: ${n.replace(/ or /g, ' o ')}? Elija uno y lo guiaré un paso a la vez.`],
  [/Which one first\? (.+?)\. Pick one and I will guide you one step at a time\./g, (m, n) => `¿Cuál primero? ${n.replace(/" or "/g, '" o "')}. Elija uno y lo guiaré un paso a la vez.`],
  [/That was the last step for "(.+?)"\. Confirm it with the agency, then mark it done on your checklist if you are using one\. Ask "what is my next step\?" when you are ready to move on\./g, 'Ese fue el último paso de "$1". Confírmelo con la agencia y luego márquelo como hecho en su lista si usa una. Pregunte "¿cuál es mi siguiente paso?" cuando esté listo para seguir.'],
  [/I can explain each step in this app: what it is, who it applies to, the official link, and fees or timing when they are recorded\. I can tell you your next step from your checklist and guide you through a step one instruction at a time\.\nI can't fill in, submit or pay for anything, I can't check with an agency for you, and this is not legal advice\. Each step is either "Source checked" with a date or Pending verification\. Confirm everything with the agency\./g, 'Puedo explicar cada paso de esta aplicación: qué es, a quién le aplica, el enlace oficial y las tarifas o tiempos cuando están registrados. Puedo decirle su siguiente paso según su lista y guiarlo por un paso, una instrucción a la vez.\nNo puedo llenar, enviar ni pagar nada, no puedo consultar con una agencia por usted, y esto no es asesoría legal. Cada paso tiene "Fuente revisada" con una fecha o Verificación pendiente. Confirme todo con la agencia.'],
  [/No\. I can't submit, fill in, pay for or file anything for you, and I can't check with an agency for you\./g, 'No. No puedo enviar, llenar, pagar ni presentar nada por usted, y no puedo consultar con una agencia por usted.'],
  [/ For "(.+?)", you do it yourself on the agency's own site\./g, ' Para "$1", usted lo hace en el sitio de la propia agencia.'],
  [/ You do it yourself on the agency's own site\./g, ' Usted lo hace en el sitio de la propia agencia.'],
  [/ I can explain the steps and guide you through them one at a time\./g, ' Puedo explicar los pasos y guiarlo uno a la vez.'],
  [/No, I can't guarantee that\. This demo is not legal advice and nothing in it is Approved by a named reviewer yet\. Each step is either "Source checked" with a date or Pending verification, and other requirements may exist that this demo does not list\./g, 'No, no puedo garantizar eso. Esto no es asesoría legal y nada aquí está Aprobado todavía por un revisor con nombre. Cada paso tiene "Fuente revisada" con una fecha o Verificación pendiente, y pueden existir otros requisitos que no están en la lista.'],
  [/ Confirm every requirement with the relevant agency, and ask a lawyer if you need legal advice\./g, ' Confirme cada requisito con la agencia correspondiente y consulte a un abogado si necesita asesoría legal.'],
  [/No\. Nothing in this demo is Approved by a named reviewer yet\. Each step is either "Source checked" with a date, or Pending verification\./g, 'No. Nada aquí está Aprobado todavía por un revisor con nombre. Cada paso tiene "Fuente revisada" con una fecha, o Verificación pendiente.'],
  [/None of your checklist steps are Pending verification\. Confirm each one with its agency\./g, 'Ninguno de los pasos de su lista está en Verificación pendiente. Confirme cada uno con su agencia.'],
  [/No step is Pending verification right now\./g, 'Ningún paso está en Verificación pendiente en este momento.'],
  [/(\d+) of your (\d+) steps (is|are) Pending verification:/g, (m, a, b, v) => `${a} de sus ${b} pasos ${v === 'is' ? 'está' : 'están'} en Verificación pendiente:`],
  [/In this app, these steps are Pending verification:/g, 'En esta aplicación, estos pasos están en Verificación pendiente:'],
  [/Pending verification means the requirement is not confirmed in this demo, and I have no verified link or fee for it\. Confirm each with the relevant agency\./g, 'Verificación pendiente significa que el requisito no está confirmado aquí y que no tengo un enlace ni una tarifa verificados para él. Confirme cada uno con la agencia correspondiente.'],
  [/Pending verification means the requirement is not confirmed in this demo\. Confirm each with the agency\./g, 'Verificación pendiente significa que el requisito no está confirmado aquí. Confirme cada uno con la agencia.'],
  [/Choose a sample business or complete the questionnaire to see which apply to you\. Confirm each with the agency\./g, 'Elija un negocio de muestra o complete el cuestionario para ver cuáles le aplican. Confirme cada uno con la agencia.'],
  [/Choose a sample business or complete the questionnaire to see which apply to you\./g, 'Elija un negocio de muestra o complete el cuestionario para ver cuáles le aplican.'],
  [/You have not marked any step as done yet\. Marking is your own simulated tracking\./g, 'Aún no ha marcado ningún paso como hecho. Marcar es su propio seguimiento simulado.'],
  [/You have marked (\d+) of (\d+) steps done \(simulated tracking\):/g, 'Ha marcado $1 de $2 pasos como hechos (seguimiento simulado):'],
  [/Every step on your checklist is marked done \(simulated tracking\)\./g, 'Todos los pasos de su lista están marcados como hechos (seguimiento simulado).'],
  [/(\d+) of (\d+) steps are still open:/g, '$1 de $2 pasos siguen pendientes:'],
  [/Your next step is: /g, 'Su siguiente paso es: '],
  [/Your checklist has no employee steps, based on your answers\. If you plan to hire, edit your answers to see them\./g, 'Su lista no tiene pasos para empleados, según sus respuestas. Si planea contratar, edite sus respuestas para verlos.'],
  [/For employees, your checklist has these steps:/g, 'Para empleados, su lista tiene estos pasos:'],
  [/If you hire, these steps may matter:/g, 'Si contrata personal, estos pasos pueden importar:'],
  [/Here is the difference:/g, 'Esta es la diferencia:'],
  [/The license guide itself says: "(.+?)" So the wizard is the tool that tells you what to apply for\./g, 'La propia guía de la licencia dice: "$1" Así que el asistente es la herramienta que le dice para qué debe solicitar.'],
  [/Pick one and I will guide you one step at a time\./g, 'Elija uno y lo guiaré un paso a la vez.'],
  [/I answer questions about the steps in this checklist, using only the rules and guides in this app\. Ask about a license, a filing, fees, timing, or what comes next on your checklist\./g, 'Respondo preguntas sobre los pasos de esta lista, usando solo las reglas y guías de esta aplicación. Pregunte por una licencia, un trámite, tarifas, tiempos o qué sigue en su lista.'],
  [/You are welcome\. Ask me about any step, its fees or timing, or say "what is my next step\?" anytime\./g, 'De nada. Pregúnteme por cualquier paso, sus tarifas o tiempos, o diga "¿cuál es mi siguiente paso?" cuando quiera.'],
  [/Good luck with your business\. Confirm each requirement with the agency before you apply\. I am here if you have more questions\./g, 'Mucha suerte con su negocio. Confirme cada requisito con la agencia antes de presentar su solicitud. Aquí estoy si tiene más preguntas.'],
  [/Related steps: /g, 'Pasos relacionados: '],
  [/Here is that step again\./g, 'Aquí está ese paso otra vez.'],
  [/Here is "(.+?)" again, in more detail\./g, 'Aquí está "$1" otra vez, con más detalle.'],
  [/If you have completed the first (\d+) steps? \((.+?)\):/g, 'Si ya completó los primeros $1 pasos ($2):'],
  [/I don't have a verified official link for a pending county or local requirement, and I won't guess one\. Pending verification means the source was not reviewed\./g, 'No tengo un enlace oficial verificado para un requisito pendiente del condado o local, y no voy a adivinar uno. Verificación pendiente significa que la fuente no se revisó.'],
  [/Pending steps: /g, 'Pasos pendientes: '],
  [/To find the right county or city office, the state's Business Licensing Wizard lists agencies to contact for your business\. Confirm with your county health department\./g, 'Para encontrar la oficina correcta del condado o de la ciudad, el Asistente de licencias comerciales del estado lista las agencias que debe contactar para su negocio. Confirme con el departamento de salud de su condado.'],
  [/In this app's usual order, the first step is:/g, 'En el orden habitual de esta aplicación, el primer paso es:'],
  [/I can't confirm that it is definitely required\. This requirement is Pending verification, so I do not have a verified answer\./g, 'No puedo confirmar que sea definitivamente obligatorio. Este requisito está en Verificación pendiente, así que no tengo una respuesta verificada.'],
  [/I can't confirm that it is definitely required\. This requirement is Pending verification\./g, 'No puedo confirmar que sea definitivamente obligatorio. Este requisito está en Verificación pendiente.'],
  [/I can't guarantee that\. This reflects an agency page that was checked, and it is not yet Approved by a named reviewer\./g, 'No puedo garantizar eso. Esto refleja una página de agencia que se revisó, y aún no está Aprobada por un revisor con nombre.'],
  [/This demo has no verified rule for a specific city or county\./g, 'No hay una regla verificada para una ciudad o condado específico.'],
  [/"(.+?)" is on your checklist, but it is Pending verification, so I can't confirm it is required\./g, '"$1" está en su lista, pero está en Verificación pendiente, así que no puedo confirmar que sea obligatorio.'],
  [/(It is|Yes,) "(.+?)" is on your checklist \((.+?)\)\./g, '"$2" está en su lista ($3).'],
  [/No\. "(.+?)" is not on your checklist, based on your answers\./g, 'No. "$1" no está en su lista, según sus respuestas.'],
  [/If your plans change, edit your answers to update your checklist\./g, 'Si sus planes cambian, edite sus respuestas para actualizar su lista.'],
  [/I don't have a verified official link for this step, and I won't guess one\./g, 'No tengo un enlace oficial verificado para este paso, y no voy a adivinar uno.'],
  [/The link below is the state page this statement came from\. It does not confirm a county or local requirement\./g, 'El enlace de abajo es la página estatal de donde viene esta declaración. No confirma un requisito del condado ni local.'],
  [/On your checklist: (.+?)\./g, 'En su lista: $1.'],
  [/This step is not on your checklist based on your answers\./g, 'Este paso no está en su lista según sus respuestas.'],
  // describeRule pieces
  [/\(Needs verification\)/g, '(Falta verificar)'],
  [/ Checked (\d{4}-\d{2}-\d{2})\./g, ' Revisado el $1.'],
  [/These are the agency's own statements and estimates\. Confirm with the agency\./g, 'Estas son las declaraciones y estimaciones de la propia agencia. Confirme con la agencia.'],
  [/I don't have a verified fee or timing for this step in the current rules\/guides\./g, 'No tengo una tarifa ni un tiempo verificados para este paso en las reglas y guías actuales.'],
  [/^Steps:$/gm, 'Pasos:'],
  [/Who it applies to: /g, 'A quién le aplica: '],
  [/Conditions: /g, 'Condiciones: '],
  // status line
  [/Pending verification: (.+?) Confirm it with the relevant agency\./g, 'Verificación pendiente: $1 Confirme con la agencia correspondiente.'],
  [/this requirement is not confirmed in this demo\./g, 'este requisito no está confirmado aquí.'],
  [/Source checked( on (\d{4}-\d{2}-\d{2}))?\. Not yet Approved by a named reviewer\. Confirm with the agency\./g, (m, x, d) => `Fuente revisada${d ? ` el ${d}` : ''}. Aún sin Aprobación de un revisor con nombre. Confirme con la agencia.`],
  // labels and chips
  [/Pending verification/g, 'Verificación pendiente'],
  [/Applies to you/g, 'Le aplica'],
  [/May apply, confirm/g, 'Puede aplicar, confirme'],
  [/\(Verificación pendiente\)/g, '(Verificación pendiente)'],
  [/ \(marked done\)/g, ' (marcado como hecho)'],
];

const LINKS = [[/^Start this step$/, 'Iniciar este paso'], [/^Source: /, 'Fuente: ']];

export const SUGGEST_ES = {
  'How do I get started?': '¿Cómo empiezo?',
  'Do I need a business license?': '¿Necesito una licencia comercial?',
  'What is my next step?': '¿Cuál es mi siguiente paso?',
  'What is the first step?': '¿Cuál es el primer paso?',
  'Show my full checklist': 'Mostrar mi lista completa',
  'What is still pending?': '¿Qué sigue pendiente?',
  'How do I do this step?': '¿Cómo hago este paso?',
  'What comes after that?': '¿Qué viene después?',
  'Guide me through it': 'Guíeme paso a paso',
  'How do I report new hires?': '¿Cómo reporto nuevas contrataciones?',
  'How much is the business license fee?': '¿Cuánto cuesta la licencia comercial?',
  'How long does the DOR license take?': '¿Cuánto tarda la licencia del DOR?',
  "What is workers' compensation?": '¿Qué es la compensación para trabajadores?',
  Next: 'Siguiente',
};

export function toSpanish(text, map) {
  let out = String(text ?? '');
  // The rule text first, longest first, so a long sentence is replaced before a short title inside it.
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  for (const k of keys) if (out.includes(k)) out = out.split(k).join(map.get(k));
  for (const [rx, to] of PHRASES) out = out.replace(rx, to);
  return out;
}

export function linkToSpanish(link, map) {
  let label = String(link.label || '');
  for (const [rx, to] of LINKS) label = label.replace(rx, to);
  // "Source: <English source label>" -> "Fuente: <Spanish source label>"
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  for (const k of keys) if (label.includes(k)) label = label.split(k).join(map.get(k));
  return { ...link, label };
}

export function suggestionToSpanish(s, map) {
  if (SUGGEST_ES[s]) return SUGGEST_ES[s];
  const g = /^Guide me through (.+)$/.exec(s);
  if (g) return `Guíeme por ${map.get(g[1]) || g[1]}`;
  return s;
}

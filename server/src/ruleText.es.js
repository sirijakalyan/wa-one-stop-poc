// Spanish text for the rule records, times and found links. This is a DRAFT translation made by the build assistant.
// A person (Olger Palma, whose recorded skills include Spanish, per the build spec) must review it. Nobody has.
// Figures, names of forms, agency names and web addresses are copied exactly from the English records.
// Each entry applies only while the English rule is still at the same version, so an admin edit to the English text is never hidden.

export const PHASES_ES = {
  1: 'Forme su negocio',
  2: 'Obtenga la licencia de su negocio',
  3: 'Credenciales y permisos del sector',
  4: 'Si contrata personal o usa contratistas',
  5: 'Requisitos locales',
};

export const STRUCTURE_ES = { sole: 'Propietario único', llc: 'LLC', corp: 'Corporación', partnership: 'Sociedad o LLP', unsure: 'Estructura aún no definida' };

// Condition labels used inside "For you: ..." and "You were not sure about: ...".
export const COND_ES = {
  'you plan to hire within 90 days': 'usted planea contratar personal en los próximos 90 días',
  'you sell something that requires collecting sales tax': 'usted vende algo que requiere cobrar impuesto sobre las ventas',
  'you expect gross income of $12,000 a year or more': 'usted espera ingresos brutos de $12,000 al año o más',
  'you use a name other than your full legal name': 'usted usa un nombre distinto de su nombre legal completo',
  hiring: 'contratar personal',
  'sales tax': 'el impuesto sobre las ventas',
  income: 'los ingresos',
  'business name': 'el nombre comercial',
};

export const LEFT_OUT_ES = {
  'lni-contractor': ' Usar subcontratistas no convierte a un negocio en contratista de construcción. Este paso depende solo del tipo de negocio. Elija "Construcción y contratistas" como tipo de negocio si eso es lo que hace.',
};

export const AGENCY_ES = {
  'Secretary of State': 'Secretario de Estado',
  'Dept. of Revenue (BLS)': 'Depto. de Ingresos (BLS)',
  'Labor & Industries': 'Depto. de Trabajo e Industrias (L&I)',
  'County health department': 'Departamento de salud del condado',
  'Employment Security Dept.': 'Depto. de Seguridad del Empleo (ESD)',
  'DSHS': 'DSHS',
  'Your city and county': 'Su ciudad y condado',
};

export const RULES_ES = {
  sos: {
    version: 1,
    supports: 'El DOR indica que presentar ante el Secretario de Estado es obligatorio para las LLC, corporaciones y ciertas sociedades antes de la Solicitud de Licencia Comercial. Enumera aparte a los propietarios únicos sin esa presentación. La página del SOS es solo el centro de presentaciones.',
    limits: 'No es obligatorio para un propietario único. Los bancos están exceptuados en el caso de las corporaciones. Otras estructuras pueden ser distintas.',
    vnote: 'Texto de la página del DOR leído el 2026-10-26 y respalda la regla de presentación de la entidad.',
    title: 'Presente su entidad comercial ante el Secretario de Estado',
    reason: {
      applies: 'Usted eligió {structure}. Las corporaciones, sociedades, LLC y LLP de Washington se presentan ante el Secretario de Estado antes de la Solicitud de Licencia Comercial.',
      maybe: 'No está seguro de su estructura. Si forma una LLC, corporación, sociedad o LLP, este paso va antes de la licencia comercial.',
      no: 'Se omite porque los propietarios únicos empiezan con el Departamento de Ingresos, no con el Secretario de Estado.',
    },
    detail: 'Esto se aplica a entidades de Washington (nacionales del estado). Si su entidad se formó en otro estado, los pasos son distintos. Pregunte al Secretario de Estado.',
    apply: 'Iniciar o registrar un negocio en Washington',
    fallback: 'Si la página no abre, busque "Iniciar un negocio nacional de WA" en sos.wa.gov.',
    guide: {
      meaning: 'Una LLC, corporación o cierta sociedad de Washington se forma presentando documentos ante el Secretario de Estado. El DOR exige esta presentación antes de enviar la Solicitud de Licencia Comercial.',
      who: ['LLC, corporaciones y sociedades nacionales y sociedades de responsabilidad limitada, tal como las enumera el DOR.'],
      conditions: ['El DOR enumera a los propietarios únicos sin esta presentación, por eso este paso se omite para ellos.', 'El DOR indica que la presentación es obligatoria para las corporaciones, excepto los bancos.'],
      prepare: [],
      prepareNote: 'No se revisó una lista de documentos para esta presentación. El sitio del Secretario de Estado tiene los detalles.',
      steps: ['Decida la estructura de su negocio.', 'Abra la página del Secretario de Estado para iniciar un negocio en Washington, elija su tipo de entidad y siga las instrucciones. La presentación se hace en el sistema de presentación en línea del Secretario de Estado, que requiere una cuenta de usuario.', 'Luego solicite su licencia comercial de Washington ante el DOR. Ese es el siguiente paso de esta lista.'],
      facts: [],
      whyExternal: 'Las presentaciones de entidades se hacen en el sistema del Secretario de Estado, que necesita su propia cuenta. El botón abre la página de inicio del Secretario de Estado, donde usted elige su tipo de entidad. Esta demostración no puede presentar nada por usted.',
    },
  },
  dor: {
    version: 1,
    supports: 'El DOR enumera cuándo debe registrarse y obtener una licencia comercial, incluidos contratar personal en 90 días, el impuesto sobre las ventas, $12,000 de ingresos brutos y usar un nombre distinto del nombre legal. También indica usar el Asistente de licencias comerciales para solicitar.',
    limits: 'El DOR enumera otros motivos por los que esta demostración no pregunta, como los umbrales de nexo. Las estimaciones de procesamiento son del propio DOR y no son fechas garantizadas. No se muestra ningún monto de tarifa porque el DOR indica que varía.',
    vnote: 'Texto de la página del DOR releído el 2026-10-26 y las declaraciones de tiempos comparadas con la página. El tiempo del correo con endosos no se indica y está marcado como Necesita verificación.',
    title: 'Solicite su licencia comercial de Washington',
    reason: {
      applies: 'Debe registrarse ante el Departamento de Ingresos si se cumple cualquiera de los motivos. En su caso: {hits}.',
      maybe: 'No estaba seguro sobre: {unsure}. Si cualquiera de estos es cierto, necesita la licencia.',
      no: 'Se omite porque ninguno de los motivos de registro por los que preguntamos se cumple en su caso. Existen otros motivos, así que use el Asistente oficial de licencias comerciales para estar seguro.',
    },
    detail: 'El DOR da estimaciones, no fechas garantizadas. Las estimaciones para solicitudes en línea, solicitudes con endosos de ciudad o estado, y solicitudes por correo aparecen en Montos y tiempos en la guía. La tarifa varía y cada endoso tiene su propia tarifa.',
    apply: 'Inicie sesión en Mi DOR para solicitar (se necesita una cuenta SAW)',
    fallback: 'Si la página de inicio de sesión no abre, empiece en la página "Abrir un negocio" del DOR (dor.wa.gov/open-business).',
    guide: {
      meaning: 'Una licencia comercial de Washington registra su negocio ante el Departamento de Ingresos. Se le asigna un número de Identificador Comercial Único (UBI) que usa cuando presenta impuestos o cambia su negocio.',
      who: ['Todo negocio que cumpla al menos un motivo de registro del DOR.'],
      conditions: [
        'El DOR enumera estos motivos: su negocio necesita endosos de ciudad, condado o estado; usa un nombre distinto de su nombre legal completo; planea contratar personal en los próximos 90 días; vende algo que requiere cobrar impuesto sobre las ventas; sus ingresos brutos son de $12,000 al año o más; debe pagar impuestos o tarifas al DOR; compra o procesa productos especiales de madera; cumple requisitos de informe por umbral de nexo.',
        'Esta demostración pregunta solo por algunos motivos. Use el Asistente de licencias comerciales para estar seguro.',
        'Si su estructura es una LLC, corporación o sociedad, el DOR indica presentar primero ante el Secretario de Estado.',
      ],
      prepare: [],
      prepareNote: 'El DOR le da los formularios y endosos para su caso después de que usted use el Asistente de licencias comerciales.',
      steps: [
        'Revise cuáles motivos de registro se cumplen en su caso.',
        'Use el Asistente de licencias comerciales. Le da una lista de agencias con las que comunicarse y los endosos que correspondan.',
        'Solicite en línea en el sistema seguro Mi DOR del DOR. Inicia sesión con un identificador de usuario de Acceso Seguro de Washington (SAW), y la página de inicio de sesión tiene un enlace de registro para usuarios nuevos. O solicite por correo con la Solicitud de Licencia Comercial y el pago.',
        'Guarde su número UBI. Lo necesita para impuestos y cambios.',
      ],
      facts: [
        ['Solicitud en línea', 'El DOR indica que las solicitudes en línea tardan aproximadamente 10 días hábiles en procesarse.'],
        ['Solicitud en línea con endosos de ciudad o estado', 'El DOR indica que puede tardar de 2 a 3 semanas adicionales en recibir su licencia comercial por el tiempo de aprobación. La página no indica un tiempo para los endosos del condado.'],
        ['Solicitud por correo', 'El DOR indica que las solicitudes por correo pueden tardar hasta seis semanas en procesarse.'],
        ['Correo con endosos', 'La página del DOR no da un tiempo aparte para una solicitud por correo que tenga endosos. Necesita verificación con el DOR.'],
        ['Tarifa', 'El DOR indica que la tarifa de solicitud varía y que cada endoso adicional tiene su propia tarifa. El DOR explica cómo calcular la tarifa. Aquí no se muestra ningún monto.'],
      ],
      whyExternal: 'Las solicitudes se envían en el sistema de cuentas seguro Mi DOR del DOR, que también se usa para presentar impuestos. El botón abre la página de inicio de sesión de Mi DOR. Esta demostración nunca le pide sus datos de inicio de sesión y no puede enviar la solicitud.',
    },
  },
  wizard: {
    version: 1,
    supports: 'El DOR indica que el asistente devuelve una lista de licencias de ciudad, estado y federales que su negocio puede necesitar, la información de contacto de cada una y los próximos pasos para la licencia comercial estatal.',
    limits: 'El asistente necesita cookies. Sus preguntas no se revisaron y su lógica no se copia.',
    vnote: 'Texto de la página del DOR leído el 2026-10-26. La página del asistente carga pero sus preguntas no se revisaron.',
    title: 'Confirme su lista con el Asistente oficial de licencias comerciales',
    reason: {
      applies: 'Esta demostración es un esbozo. El asistente estatal le da las agencias con las que comunicarse y los endosos para su negocio, así que úselo para revisar esta lista.',
      maybe: '', no: '',
    },
    detail: 'Use el asistente oficial para confirmar sus requisitos reales. Le da las licencias de ciudad, estado y federales que su negocio puede necesitar, con contactos y próximos pasos. Esta demostración es un esbozo y no lo reemplaza.',
    apply: 'Abrir el Asistente de licencias comerciales',
    fallback: 'Si el asistente no carga, active las cookies o empiece en la página "Abrir un negocio" del DOR (dor.wa.gov/open-business).',
    guide: {
      meaning: 'El Asistente de licencias comerciales es la herramienta oficial del Departamento de Ingresos. Le da las licencias de ciudad, estado y federales que su negocio puede necesitar, con contactos y próximos pasos.',
      who: ['Todos. Esta demostración es un esbozo, por eso cada lista incluye este paso.'],
      conditions: ['El asistente necesita que las cookies estén activadas.', 'Sus preguntas no se revisaron para esta demostración, y esta demostración no copia su lógica.'],
      prepare: [], prepareNote: '',
      steps: ['Abra el asistente.', 'Responda sus preguntas sobre su negocio.', 'Compare su lista de licencias y contactos con esta lista. Siga al asistente donde sean distintos.'],
      facts: [],
      whyExternal: 'El asistente es una herramienta del DOR. Solo el DOR puede darle su lista oficial.',
    },
  },
  'lni-contractor': {
    version: 1,
    supports: 'L&I indica que todos los contratistas de construcción deben registrarse, tener fianza y contar con seguro de responsabilidad civil. Da la tarifa de solicitud, el monto de la fianza de cada clasificación, los montos del seguro de responsabilidad civil, y los tiempos de la solicitud por correo y de la tarjeta de registro. Nombra oficios con requisitos adicionales.',
    limits: 'El monto de la fianza depende de la clasificación. Los requisitos específicos de un oficio o de una actividad se aplican solo a esos oficios y actividades. Los montos y tiempos son declaraciones de L&I leídas el 2026-10-26 y pueden cambiar.',
    vnote: 'Texto de la página de L&I releído completo el 2026-10-26 y las cifras de tarifa, fianza, seguro y tiempos comparadas con la página. Las declaraciones de tiempos de procesamiento que se superponen están marcadas como Necesita verificación.',
    title: 'Regístrese como contratista en el Departamento de Trabajo e Industrias',
    reason: {
      applies: 'Usted eligió construcción y contratistas. L&I exige que los contratistas de construcción se registren en L&I. La licencia comercial no cubre esto.',
      maybe: '', no: 'Se omite porque no eligió construcción y contratistas.',
    },
    detail: 'L&I indica que los contratistas de construcción deben registrarse en L&I y tener fianza y seguro. El monto de la fianza depende de su clasificación (general o especialidad). Oficios como plomería, electricidad, ascensores, instalación de casas móviles, calderas y asbesto tienen requisitos adicionales de educación, examen y licencia, y algunas actividades tienen licencia además del registro. Las tarifas y montos que indica L&I aparecen en Montos y tiempos en la guía con la fecha en que se leyeron. Pueden cambiar, así que confirme con L&I.',
    apply: 'Ir al registro de contratistas de L&I',
    fallback: 'Si el enlace no abre, busque "Registrarse como contratista" en lni.wa.gov.',
    guide: {
      meaning: 'Washington exige que los contratistas de construcción se registren en el Departamento de Trabajo e Industrias (L&I). Una vez registrado, un contratista puede presentar ofertas, hacer publicidad y realizar trabajos de construcción. L&I también indica que la ley estatal exige que los contratistas tengan fianza y seguro.',
      who: ['Contratistas de construcción, incluidos trabajos como construir, remodelar, reparar y demoler edificios, caminos y otros bienes inmuebles.'],
      conditions: [
        'L&I tiene dos clasificaciones. Los contratistas generales pueden realizar la mayoría de los tipos de trabajo de construcción y pueden contratar subcontratistas de varias especialidades. Los contratistas de especialidad solo pueden trabajar en su especialidad y no pueden contratar subcontratistas.',
        'El monto de la fianza depende de la clasificación: un monto para contratistas generales y otro para contratistas de especialidad.',
        'L&I enumera los montos del seguro de responsabilidad civil en su página sin separarlos por clasificación. Confirme sus propios requisitos con L&I, porque pueden aplicar otras reglas a su oficio.',
        'Los trabajos de plomería, electricidad, ascensores, instalación de casas móviles, calderas y asbesto tienen requisitos adicionales de educación, examen y licencia. Estos se aplican solo a esos oficios.',
        'L&I indica que algunas actividades tienen requisitos de licencia además del registro de contratista, por ejemplo el trabajo con pintura a base de plomo y la aplicación de pesticidas. Estos se aplican solo a esas actividades.',
        'L&I regula 63 especialidades que requieren cada una el registro de contratista.',
      ],
      prepare: [
        'El nombre y la estructura de su negocio, o su registro comercial ante el DOR y su número UBI.',
        'Una fianza continua de contratista o una cesión de ahorros.',
        'Un certificado de seguro de responsabilidad civil general. L&I debe aparecer como titular del certificado, y la fianza y el seguro deben usar el nombre exacto de su negocio.',
        'La Solicitud de Registro de Contratista completa (F625-001-000). Todas las firmas deben ser originales y notariadas.',
        'La tarifa de registro.',
      ],
      prepareNote: '',
      steps: [
        'Registre su negocio ante el Departamento de Ingresos.',
        'Obtenga una fianza o una cesión de ahorros.',
        'Compre una póliza de seguro de responsabilidad civil general.',
        'Complete la Solicitud de Registro de Contratista y pague la tarifa.',
        'Preséntela en su oficina local de L&I, o envíela por correo a L&I. L&I indica que puede ayudarle a completar la solicitud en persona.',
      ],
      facts: [
        ['Tarifa de solicitud', '$150.20, según indica L&I para el registro.'],
        ['Fianza, contratistas generales', 'Fianza continua de contratista de $30,000, según indica L&I. Las primas de la fianza varían según la compañía y no se muestran.'],
        ['Fianza, contratistas de especialidad', 'Fianza continua de contratista de $15,000, según indica L&I. L&I nombra una cuenta bancaria cedida como alternativa a la fianza.'],
        ['Seguro de responsabilidad civil general', '$200,000 de responsabilidad pública y $50,000 de daños a la propiedad, o $250,000 de límite único combinado, según indica L&I. L&I debe aparecer como titular del certificado.'],
        ['Procesamiento y activación, solicitud por correo', 'L&I indica que las solicitudes por correo completas tardan actualmente de 3 a 4 semanas después de recibirse en procesarse y activar su registro.'],
        ['Tarjeta de registro', 'L&I indica que cuando su negocio esté registrado recibirá una tarjeta de registro en unas 2 semanas. Esta es una etapa posterior al procesamiento y la activación.'],
        ['Otros tiempos de procesamiento', 'L&I también publica un aviso general de retraso para los documentos enviados a su oficina. La página no dice cómo se relaciona ese aviso con el tiempo de la solicitud por correo de arriba, y no da un tiempo para las solicitudes en persona, así que no se muestra ninguna estimación. Necesita verificación con L&I.'],
      ],
      whyExternal: 'El registro se completa con L&I, en persona en una oficina de L&I o por correo. Esta demostración no puede registrarlo.',
    },
  },
  health: {
    version: 1,
    supports: 'La página del DOR solo respalda al asistente como el lugar para obtener una lista de agencias. No se revisó ninguna página oficial de salud del condado para esta regla.',
    limits: 'Los requisitos de los condados son distintos. El condado se desconoce en esta demostración.',
    vnote: 'Verificación pendiente. La declaración sobre el permiso de salud del condado vino de la lista de verificación comercial estatal leída antes en este proyecto. Ese sitio devolvió el error 502 el 2026-10-26, así que no se pudo releer. La fuente exacta del condado no se ha revisado.',
    title: 'Revise si necesita un permiso del departamento de salud del condado',
    reason: {
      applies: 'Usted eligió servicio de comida. Los negocios de comida pueden necesitar un permiso del departamento de salud del condado. El asistente estatal de licencias comerciales enumera las agencias con las que comunicarse para su negocio.',
      maybe: '', no: 'Se omite porque no eligió servicio de comida.',
    },
    detail: 'Comuníquese con el departamento de salud de su condado antes de abrir.',
    apply: null,
    fallback: 'Busque "health department food business permit" junto con el nombre de su condado.',
    noLink: 'No ha indicado un condado. Esta demostración no tiene un enlace del departamento de salud del condado. Confirme qué permisos necesita con el departamento de salud de su condado.',
    noLinkCounty: 'Usted seleccionó el condado de {countyName}. Confirme los requisitos del permiso de alimentos con el departamento de salud de ese condado. Esta demostración no tiene un enlace verificado para él.',
    guide: {
      meaning: 'Los negocios de comida, como los restaurantes, pueden necesitar un permiso del departamento de salud del condado.',
      who: ['Negocios de servicio de comida. El condado depende de dónde esté ubicado el negocio.'],
      conditions: ['No se revisó ninguna fuente del condado. El condado que usted escribe solo nombra a su condado en este paso. No confirma ningún requisito del condado, y las reglas de los condados son distintas.'],
      prepare: [],
      prepareNote: 'No revisado. Pregunte al departamento de salud de su condado qué debe preparar.',
      steps: ['Encuentre el departamento de salud de su condado. Si escribió un condado en el cuestionario, aparece nombrado en el mensaje de la tarjeta de la lista.', 'Pregunte qué permisos e inspecciones se aplican a su negocio de comida.'],
      facts: [],
      pendingNote: 'La fuente exacta del condado no se ha revisado, por eso no se muestra ningún enlace ni requisito del condado.',
      whyExternal: '',
    },
  },
  'lni-wc': {
    version: 1,
    supports: 'L&I indica que es posible que deba proporcionar compensación para trabajadores si tiene trabajadores, y que la cobertura privada no se permite en Washington.',
    limits: 'La página dice \'podría\'. Existen exenciones y autoseguro. Se aplica solo si tiene trabajadores.',
    vnote: 'Texto de la página de L&I leído el 2026-10-26.',
    title: 'Contrate el seguro de compensación para trabajadores',
    reason: {
      applies: 'Usted planea contratar personal. L&I indica que si tiene trabajadores, es posible que deba proporcionar compensación para trabajadores.',
      maybe: 'No estaba seguro sobre contratar personal. L&I indica que si tiene trabajadores, es posible que deba proporcionar compensación para trabajadores.',
      no: 'Se omite porque no planea contratar personal en los próximos 90 días.',
    },
    detail: 'L&I indica que los empleadores compran la compensación para trabajadores a L&I, a menos que L&I los apruebe como autoasegurados, y que algunos trabajadores están exentos según definiciones estrictas. Confirme con L&I si sus trabajadores deben estar cubiertos. En esta demostración no se muestran las tarifas.',
    apply: 'Vea cómo obtener una cuenta de compensación para trabajadores (L&I)',
    fallback: 'Si el enlace no abre, busque "Cómo obtener una cuenta de compensación para trabajadores" en lni.wa.gov.',
    guide: {
      meaning: 'El seguro de compensación para trabajadores da reemplazo de salario y beneficios médicos a los trabajadores lesionados en el trabajo. En Washington usted compra la cobertura a L&I, o se le aprueba como empleador autoasegurado. No se permite la cobertura privada.',
      who: ['Negocios que tienen trabajadores, sean empleados o contratistas independientes. L&I indica que es posible que deba proporcionar cobertura.'],
      conditions: ['L&I indica que todos los trabajadores tienen derecho a cobertura a menos que cumplan definiciones estrictas de exención.', 'Use el paso de contratistas independientes para revisar si un contratista debe estar cubierto.', 'Los empleadores presentan informes trimestrales y pagos de primas según su industria y las horas de sus trabajadores.'],
      prepare: [],
      prepareNote: 'No se revisó una lista de documentos. L&I explica cómo obtener una cuenta en su sitio.',
      steps: [
        'Decida si sus trabajadores deben estar cubiertos.',
        'Si va a contratar empleados, L&I indica que usted obtiene su cuenta de compensación para trabajadores al solicitar, o actualizar, su licencia comercial estatal ante el DOR. Si no tiene licencia comercial, solicite una. Si ya tiene una, actualice la información de su negocio para indicar que va a contratar personal.',
        'L&I indica que luego un administrador de cuenta se comunicará con usted para configurar su póliza. Lea la página de L&I para saber qué sigue.',
        'Planee presentar informes trimestrales y pagos de primas.',
      ],
      facts: [],
      whyExternal: 'L&I indica que la cuenta se obtiene mediante su solicitud de licencia comercial ante el DOR, que se hace en Mi DOR. El botón abre la página de L&I que lo explica. Esta demostración no puede abrir una cuenta por usted.',
    },
  },
  esd: {
    version: 1,
    supports: 'El ESD indica que todo empleador de Washington presenta dos informes cada trimestre, y su página de impuestos de desempleo cubre el pago de impuestos y los empleadores de reembolso.',
    limits: 'Las páginas del ESD que se leyeron no indican el paso de registro de la cuenta en sí.',
    vnote: 'Páginas del ESD leídas el 2026-10-26: la página de informes trimestrales y la guía para empleadores sobre el pago de impuestos. Describen los pasos, pero ningún revisor los ha confirmado todavía.',
    title: 'Regístrese para los impuestos de empleador en el Departamento de Seguridad del Empleo',
    reason: {
      applies: 'Usted planea contratar personal. El ESD indica que todo empleador en Washington presenta dos informes de impuestos y salarios cada trimestre.',
      maybe: 'No estaba seguro sobre contratar personal. El ESD indica que todo empleador en Washington presenta dos informes de impuestos y salarios cada trimestre.',
      no: 'Se omite porque no planea contratar personal en los próximos 90 días.',
    },
    detail: 'El ESD indica que los empleadores presentan informes trimestrales de impuestos y salarios y pagan impuestos de desempleo. Algunos empleadores, como los empleadores de reembolso, pagan de otra manera. Confirme con el ESD la configuración de su cuenta y sus obligaciones. En esta demostración no se muestran las tarifas.',
    apply: 'Vea la guía del ESD sobre impuestos de empleador',
    fallback: 'Si el enlace no abre, busque "guía para empleadores sobre el pago de impuestos" en esd.wa.gov.',
    guide: {
      meaning: 'El Departamento de Seguridad del Empleo (ESD) cobra impuestos de desempleo a los empleadores. El ESD indica que todo empleador en Washington presenta dos informes de impuestos y salarios cada trimestre.',
      who: ['Empleadores. La demostración muestra este paso cuando usted planea contratar personal.'],
      conditions: ['Los empleadores de reembolso no pagan impuestos de desempleo. Le reembolsan al ESD los beneficios pagados a sus empleados que se separaron.', 'Verificación pendiente. Las páginas del ESD que se revisaron no indicaron el paso de registro de la cuenta, por eso esta demostración no lo describe.'],
      prepare: [],
      prepareNote: 'No revisado.',
      steps: [
        'Si es un empleador nuevo, el ESD indica que usted solicita una licencia comercial estatal al DOR antes de poder presentar un informe trimestral de impuestos y salarios. Si ya tiene licencia pero contrata personal por primera vez, actualice su solicitud de licencia comercial.',
        'Presente su informe de impuestos y salarios cada trimestre, aunque no tenga nómina que informar.',
        'Pague sus impuestos en línea en el Sistema de Administración de Cuentas de Empleadores del ESD con Acceso Seguro de Washington, o por correo con los formularios que envía el ESD. Lea la guía del ESD para los detalles.',
      ],
      facts: [],
      pendingNote: 'La guía para empleadores del ESD se leyó el 2026-10-26 y describe estos pasos, pero ningún revisor los ha confirmado todavía, por eso este requisito sigue pendiente. Confirme con el ESD.',
      whyExternal: 'La guía para empleadores del ESD explica estos pasos, y la cuenta y los pagos se manejan en los sistemas propios del ESD. Esta demostración no puede registrarlo ni recibir pagos.',
    },
  },
  dshs: {
    version: 1,
    supports: 'El DSHS indica el plazo de 20 días para informar, la definición de recontratación de 60 días y la exención tribal. La página del ESD coincide en los 20 días.',
    limits: 'Exención para las tribus y para los negocios de propiedad tribal o de indígenas en reservas.',
    vnote: 'Texto de las páginas del DSHS y del ESD leído el 2026-10-26.',
    title: 'Informe las nuevas contrataciones al DSHS',
    reason: {
      applies: 'Usted planea contratar personal. El DSHS indica que los empleadores deben informar los empleados recién contratados o recontratados.',
      maybe: 'No estaba seguro sobre contratar personal. Si contrata, el DSHS indica que los empleadores deben informar los empleados recién contratados o recontratados.',
      no: 'Se omite porque no planea contratar personal en los próximos 90 días.',
    },
    detail: 'El DSHS indica que se debe informar cada empleado nuevo o recontratado dentro de los 20 días de la contratación o recontratación, sin importar la edad ni las horas trabajadas. Una recontratación cuenta después de una separación de al menos 60 días consecutivos. Las tribus y los negocios de propiedad tribal o de indígenas en reservas están exentos, aunque los informes voluntarios son bienvenidos.',
    apply: 'Ir al informe de nuevas contrataciones del DSHS',
    fallback: 'Si el enlace no abre, busque "informe de nuevas contrataciones" en dshs.wa.gov.',
    guide: {
      meaning: 'La ley federal y estatal exige que los empleadores informen cada empleado recién contratado o recontratado que trabaje en Washington a la División de Manutención de Menores (DSHS). El estado compara los informes con los registros de manutención de menores.',
      who: ['Empleadores, sin importar la edad del empleado ni la cantidad de horas trabajadas.'],
      conditions: ['Una recontratación cuenta después de una separación de al menos 60 días consecutivos, o cuando el empleado empieza con un nuevo Número de Identificación Federal de Empleador.', 'El DSHS indica que las tribus, los negocios de propiedad tribal y los negocios de propiedad de indígenas ubicados en reservas están exentos, aunque los informes voluntarios son bienvenidos.'],
      prepare: ['Empleado: nombre, dirección, número de Seguro Social, fecha de nacimiento y fecha de contratación.', 'Negocio: nombre, dirección y Número de Identificación Federal de Empleador.'],
      prepareNote: '',
      steps: ['Reúna la información del empleado y del negocio.', 'Informe dentro de los 20 días de la fecha de contratación o recontratación.', 'El DSHS prefiere el informe en línea mediante Acceso Seguro de Washington con el servicio DCS en línea. El DSHS también enumera opciones por fax, correo y teléfono.'],
      facts: [['Plazo', 'Dentro de los 20 días de la fecha de inicio, según indican el DSHS y el ESD.']],
      whyExternal: 'Los informes se presentan en el servicio DCS en línea del DSHS. Esta demostración nunca recopila datos de empleados y no puede presentar informes.',
    },
  },
  ic: {
    version: 1,
    supports: 'L&I explica la prueba de trabajo personal y la prueba de 6 partes (7 partes para la construcción) para decidir si los contratistas independientes necesitan cobertura de compensación para trabajadores.',
    limits: 'El resultado depende de cada trabajador. Se requiere pasar todas las partes para quedar exento.',
    vnote: 'Texto de la página de L&I leído el 2026-10-26.',
    title: 'Revise las reglas para contratistas independientes',
    reason: {
      applies: 'Usted planea usar subcontratistas o contratistas independientes. L&I indica que los negocios con trabajadores, empleados o contratistas independientes pueden necesitar cobertura de compensación para trabajadores.',
      maybe: 'No estaba seguro sobre los subcontratistas. L&I indica que los negocios con trabajadores, empleados o contratistas independientes pueden necesitar cobertura de compensación para trabajadores.',
      no: 'Se omite porque no planea usar subcontratistas.',
    },
    detail: 'L&I indica que un formulario 1099 no es suficiente y que un UBI o un registro de contratista por sí solos no hacen exento a un trabajador. Los trabajadores deben pasar las pruebas de L&I, con una parte adicional para la construcción. Revise las pruebas con L&I.',
    apply: 'Revise las pruebas de contratistas independientes de L&I',
    fallback: 'Si el enlace no abre, busque "contratistas independientes" en lni.wa.gov.',
    guide: {
      meaning: 'L&I decide quién debe estar cubierto por la compensación para trabajadores. Contratar a alguien como contratista independiente no significa por sí solo que usted pueda omitir la cobertura.',
      who: ['Negocios que usan subcontratistas o contratistas independientes.'],
      conditions: ['Un formulario 1099 no tiene relación con la cobertura, según indica L&I.', 'Tener un número UBI o un número de registro de contratista no hace automáticamente exento a un trabajador.', 'En construcción, un trabajador también debe estar debidamente registrado como contratista o tener una licencia válida de contratista eléctrico para estar exento.', 'Si su negocio tiene trabajadores que debieron haberse informado, L&I indica que usted es responsable de las primas no pagadas con multas e intereses.'],
      prepare: ['L&I indica que debe documentar cómo cada contratista pasa cada parte de cada prueba.'],
      prepareNote: '',
      steps: [
        'Aplique la prueba de trabajo personal. Una debe cumplirse: la persona trae sus propios empleados y usted no los controla, o la persona trae equipo especializado pesado o costoso y su experiencia para operarlo y usted no la controla.',
        'Si el trabajador no la pasa, aplique la prueba de 6 partes, o la de 7 partes para la construcción. El trabajador debe pasar todas las partes para estar exento. Las partes cubren la libertad de su control, dónde y cómo se presta el servicio, un oficio o negocio independiente, la presentación de un anexo de gastos del IRS, una cuenta del DOR, y libros y registros separados.',
        'Si un trabajador está cubierto, indique que tiene trabajadores en su solicitud de licencia comercial, informe sus horas y pague las primas.',
      ],
      facts: [],
      whyExternal: 'L&I lleva las cuentas. Para una decisión sobre un trabajador específico, llame o use los recursos de L&I.',
    },
  },
  local: {
    version: 1,
    supports: 'El DOR indica que usted puede solicitar los endosos de las ciudades de la lista junto con su presentación estatal, y comunicarse directamente con cualquier ciudad que no aparezca.',
    limits: 'No se incluyen requisitos específicos de Bellevue ni de un condado.',
    vnote: 'Verificación pendiente. La fuente exacta de la ciudad o del condado (por ejemplo la Ciudad de Bellevue) no se ha revisado. No se afirma ningún requisito ni enlace local.',
    title: 'Revise los requisitos de la ciudad y del condado',
    reason: {
      applies: 'La zonificación, las licencias de la ciudad y las reglas del condado se fijan localmente y quedan fuera de la licencia estatal. Esta demostración no tiene reglas locales para {place}.',
      maybe: '', no: '',
    },
    detail: 'La zonificación, las licencias de la ciudad y las reglas del condado se fijan localmente. El DOR enumera las ciudades cuyos endosos usted puede agregar a su solicitud estatal. El DOR indica comunicarse directamente con una ciudad si no aparece en la lista. Bellevue no estaba en la lista del DOR cuando se revisó el 2026-10-26, así que confirme los requisitos de Bellevue con la Ciudad de Bellevue. No se revisó ninguna fuente local para esta demostración.',
    apply: 'Vea los endosos de ciudad del DOR',
    fallback: 'Busque en el sitio web de su ciudad o condado "licencia comercial" y "zonificación".',
    guide: {
      meaning: 'Las ciudades y los condados pueden tener sus propias licencias comerciales, zonificación y reglas además de las licencias estatales.',
      who: ['Negocios ubicados en, o que viajan a, una ciudad o condado con requisitos locales. Esta demostración no sabe cuáles aplican.'],
      conditions: ['El DOR indica que usted puede solicitar los endosos de las ciudades de la lista al mismo tiempo que su presentación estatal, y comunicarse directamente con una ciudad que no aparezca.', 'Bellevue no estaba en la lista de ciudades del DOR cuando se revisó el 2026-10-26. Confirme los requisitos de Bellevue con la Ciudad de Bellevue.', 'Verificación pendiente. No se revisó ninguna fuente de ciudad o condado.'],
      prepare: [],
      prepareNote: 'No revisado.',
      steps: ['Vea si su ciudad está en la lista de endosos de ciudad del DOR.', 'Si no está, comuníquese directamente con su ciudad o condado y pregunte por licencias comerciales y zonificación.'],
      facts: [],
      pendingNote: 'No se afirma ningún requisito local ni enlace más allá de la lista de ciudades del DOR.',
      whyExternal: 'La lista del DOR es la única fuente oficial local que se revisó.',
    },
  },
};

// Pages found by search: label, agency and note, matched by web address.
export const FOUND_ES = {
  'https://www.esd.wa.gov/employer-taxes/register-your-business': { label: 'Pasos de registro de empleadores del ESD', agency: 'Departamento de Seguridad del Empleo', note: 'El ESD indica que los empleadores con empleados en Washington deben registrarse, y enumera los pasos.' },
  'https://bellevuewa.gov/city-government/departments/finance/business-taxes/business-licenses': { label: 'Licencias comerciales de Bellevue', agency: 'Finanzas de la Ciudad de Bellevue', note: 'Bellevue indica que una licencia comercial de la ciudad es independiente de la licencia estatal y se solicita mediante el sistema FileLocal de la ciudad.' },
  'https://bellevuewa.gov/city-government/departments/development/zoning-and-land-use/zoning-requirements/home-occupations': { label: 'Reglas de ocupación en el hogar de Bellevue', agency: 'Servicios de Desarrollo de la Ciudad de Bellevue', note: 'Solo es relevante si trabaja desde su casa. Bellevue indica que por lo general se requiere un permiso de ocupación en el hogar, con algunas excepciones.' },
  'https://bellevuewa.gov/city-government/departments/development/permits/getting-started': { label: 'Permisos de Bellevue: cómo empezar', agency: 'Servicios de Desarrollo de la Ciudad de Bellevue', note: 'Para permisos de construcción y otros permisos de desarrollo.' },
};

// County health candidates: generic notes only. Agency names stay as written.
export const COUNTY_NOTE_ES = {
  'No suitable official page found in the search.': 'No se encontró en la búsqueda ninguna página oficial adecuada.',
  'Food safety program page. It covers Benton and Franklin counties.': 'Página del programa de seguridad alimentaria. Cubre los condados de Benton y Franklin.',
  'Plan review page. Plan review comes before the food permit.': 'Página de revisión de planos. La revisión de planos va antes del permiso de alimentos.',
  'Permanent food service business permit page.': 'Página del permiso permanente para negocios de servicio de comida.',
  'Food program forms page.': 'Página de formularios del programa de alimentos.',
  'General fees and permits page. Look for the food permit section.': 'Página general de tarifas y permisos. Busque la sección del permiso de alimentos.',
};

export const TIMES_ES = {
  dor: { label: 'Solicitud en línea', text: 'aproximadamente 10 días hábiles', note: 'Agregue de 2 a 3 semanas cuando se apliquen endosos de ciudad o estado. Por correo, hasta seis semanas.' },
  'lni-contractor': { label: 'Solicitud por correo, procesada y activada', text: 'de 3 a 4 semanas después de recibir la solicitud', note: 'La tarjeta de registro llega unas 2 semanas después, en una etapa posterior. No se registran otros tiempos de procesamiento de L&I.' },
};
export const SIMULATION_ES = { label: 'Solicitud en línea', text: 'aproximadamente 15 días hábiles', note: 'Cambio inventado para la demostración. La página real no ha cambiado.' };

export const TIMELINE_ES = {
  estimateNote: 'Basado en estimaciones publicadas por las agencias, no es una garantía. Cuenta solo los pasos que tienen un tiempo registrado y no cuenta los días festivos, así que su fecha real puede ser posterior.',
  record: 'Documento 11, revisión de fuentes del 2026-10-26, cifras releídas completas en las páginas de las agencias. Son estimaciones de las agencias, no fechas garantizadas.',
};

// Titles of the official pages. The English title stays in brackets so a person can find the page.
export const SOURCE_LABEL_ES = {
  "DOR, Choose an ownership structure": "DOR, Elegir una estructura de propiedad",
  "DOR, Apply for a business license": "DOR, Solicitar una licencia comercial",
  "DOR, Open a business": "DOR, Abrir un negocio",
  "L&I, Register as a Contractor": "L&I, Registrarse como contratista",
  "L&I, Do I Need a Workers' Comp Account?": "L&I, ¿Necesito una cuenta de compensación para trabajadores?",
  "ESD, Quarterly reports": "ESD, Informes trimestrales",
  "DSHS, New Hire Reporting": "DSHS, Informe de nuevas contrataciones",
  "L&I, Independent Contractors": "L&I, Contratistas independientes",
  "DOR, City endorsements": "DOR, Endosos de ciudad",
};

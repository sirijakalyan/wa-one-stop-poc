import { useCallback } from 'react';
import { api, useLoad } from '../api.js';
import { useT } from '../i18n.js';
import ExternalLink from '../components/ExternalLink.jsx';
import { statusLabel, approvalLabel, humanInput, OWNER_FALLBACK, REVIEWER_FALLBACK } from '../components/Parts.jsx';

const SOURCES = [
  ['DOR, Open a business', 'https://dor.wa.gov/open-business', 'Starting point. Explains that the Business Licensing Wizard returns the licenses your business may need.'],
  ['DOR, Apply for a business license', 'https://dor.wa.gov/open-business/apply-business-license', 'When registration is required, and how to apply.'],
  ['DOR, Choose an ownership structure', 'https://dor.wa.gov/open-business/choose-ownership-structure', 'Which structures file with the Secretary of State first. Sole proprietorships are listed without that filing.'],
  ['DOR, City endorsements', 'https://dor.wa.gov/manage-business/city-endorsements', 'Cities whose endorsements can be added to the state filing. Unlisted cities: contact the city.'],
  ['Secretary of State, Corporations & Charities', 'https://www.sos.wa.gov/corporations-charities', 'Where entity filings are made. Does not state who must file.'],
  ['L&I, Register as a Contractor', 'https://lni.wa.gov/licensing-permits/contractors/register-as-a-contractor/', 'Construction contractor registration, bond and insurance, and trades with extra requirements.'],
  ['L&I, Do I Need a Workers\' Comp Account?', 'https://lni.wa.gov/insurance/insurance-requirements/do-i-need-a-workers-comp-account/', 'Workers\' compensation for businesses that have workers.'],
  ['L&I, Independent Contractors', 'https://lni.wa.gov/insurance/insurance-requirements/independent-contractors/', 'Tests for whether independent contractors need coverage.'],
  ['ESD, Quarterly reports', 'https://esd.wa.gov/employer-requirements/quarterly-reports', 'Employers file two tax and wage reports each quarter.'],
  ['ESD, Unemployment taxes', 'https://esd.wa.gov/employer-requirements/unemployment-taxes', 'Paying unemployment taxes, penalties and reimbursable employers.'],
  ['DSHS, New Hire Reporting', 'https://www.dshs.wa.gov/family-food-and-housing-services/child-support/employer-resources/new-hire-reporting', '20-day new hire reporting, rehire definition and tribal exemption.'],
  ['DOR, My DOR sign-in (action page)', 'https://secure.dor.wa.gov/home/Login', 'Where the online Business License Application is started. Needs a Secure Access Washington user ID. Not tested past the sign-in page.'],
  ['Secretary of State, Start a Domestic (WA) Business (action page)', 'https://www.sos.wa.gov/corporations-charities/business-entities/start-or-register-business/start-domestic-wa-business', 'Choose an entity type and follow its filing instructions. The filing system needs an account.'],
  ['L&I, How to Get a Workers\' Compensation Account (action page)', 'https://lni.wa.gov/insurance/insurance-requirements/how-to-get-a-workers-compensation-account', 'Says the account is obtained through the DOR business license application.'],
  ['ESD, Employers\' guide to paying taxes (action page)', 'https://esd.wa.gov/employer-requirements/unemployment-taxes/employers-guide-paying-taxes', 'Steps for new employers, quarterly reports and payments. Still Pending verification.'],
  ['DOR, Business Licensing Wizard', 'https://secure.dor.wa.gov/gteunauth/?Link=wiz', 'Official follow-up tool. Confirm your actual requirements here. Needs cookies. Its questions were not reviewed.'],
];

const NAMES_ES = ["DOR, Abrir un negocio", "DOR, Solicitar una licencia comercial", "DOR, Elegir una estructura de propiedad", "DOR, Endosos de ciudad", "Secretario de Estado, Corporaciones y organizaciones benéficas", "L&I, Registrarse como contratista", "L&I, ¿Necesito una cuenta de compensación para trabajadores?", "L&I, Contratistas independientes", "ESD, Informes trimestrales", "ESD, Impuestos de desempleo", "DSHS, Informe de nuevas contrataciones", "DOR, Inicio de sesión de Mi DOR", "Secretario de Estado, Iniciar un negocio nacional de WA (página de acción)", "L&I, Cómo obtener una cuenta de compensación para trabajadores", "ESD, Guía para empleadores sobre el pago de impuestos", "DOR, Asistente de licencias comerciales"];
const SOURCES_ES = ["Punto de partida. Explica que el Asistente de licencias comerciales devuelve las licencias que su negocio puede necesitar.", "Cuándo es obligatorio registrarse y cómo solicitar.", "Qué estructuras se presentan primero ante el Secretario de Estado. Los propietarios únicos aparecen sin esa presentación.", "Ciudades cuyos endosos se pueden agregar a la presentación estatal. Ciudades que no aparecen: comuníquese con la ciudad.", "Dónde se hacen las presentaciones de entidades. No indica quién debe presentar.", "Registro de contratistas de construcción, fianza y seguro, y oficios con requisitos adicionales.", "Compensación para trabajadores en negocios que tienen trabajadores.", "Pruebas para saber si los contratistas independientes necesitan cobertura.", "Los empleadores presentan dos informes de impuestos y salarios cada trimestre.", "Pago de impuestos de desempleo, multas y empleadores de reembolso.", "Informe de nuevas contrataciones en 20 días, definición de recontratación y exención tribal.", "Donde se inicia la Solicitud de Licencia Comercial en línea. Necesita un identificador de usuario de Acceso Seguro de Washington. No se probó más allá de la página de inicio de sesión.", "Elija un tipo de entidad y siga sus instrucciones de presentación. El sistema de presentación necesita una cuenta.", "Indica que la cuenta se obtiene mediante la solicitud de licencia comercial del DOR.", "Pasos para empleadores nuevos, informes trimestrales y pagos. Sigue en Verificación pendiente.", "Herramienta oficial de seguimiento. Confirme aquí sus requisitos reales. Necesita cookies. Sus preguntas no se revisaron."];

export default function Sources({ embedded = false }) {
  const t = useT();
  const fetchRules = useCallback(() => api.rules(t.lang), [t.lang]);
  const { data } = useLoad(fetchRules);
  const rules = data?.rules ?? [];

  return (
    <>
      {embedded ? <h2>{t('sr.title')}</h2> : <h1 tabIndex={-1}>{t('sr.title')}</h1>}
      <p className="lead">{t('sr.lead')}</p>
      {t.lang === 'es' && <p className="draft-note">{t('sr.en')}</p>}

      <h2>{t('sr.pages')}</h2>
      <p className="hint">{t('sr.pagesHint')}</p>
      <div className="table-scroll">
        <table className="stack">
          <thead><tr><th scope="col">{t('sr.source')}</th><th scope="col">{t('sr.supports')}</th></tr></thead>
          <tbody>
            {SOURCES.map(([name, url, use], i) => (
              <tr key={url}>
                <td><ExternalLink href={url}>{t.lang === 'es' ? NAMES_ES[i] : name}</ExternalLink><br /><span className="mono-small">{url}</span></td>
                <td data-label={t('sr.supports')}>{t.lang === 'es' ? SOURCES_ES[i] : use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t('sr.wiz')}</h2>
      <p>{t('sr.wizText')}</p>
      <p>
        <ExternalLink className="btn btn-sm" href="https://secure.dor.wa.gov/gteunauth/?Link=wiz" fallback={t('sr.wizFallback')} showFallback>{t('sr.wizOpen')}</ExternalLink>
      </p>

      <div className="two-col">
        <div>
          <h2>{t('sr.simTitle')}</h2>
          <ul>
            <li>{t('sr.sim1')}</li>
            <li>{t('sr.sim2')}</li>
            <li>{t('sr.sim3')}</li>
            <li>{t('sr.sim4')}</li>
          </ul>
        </div>
        <div>
          <h2>{t('sr.notTitle')}</h2>
          <ul>
            <li>{t('sr.not1')}</li>
            <li>{t('sr.not2')}</li>
            <li>{t('sr.not3')}</li>
            <li>{t('sr.not4')}</li>
          </ul>
        </div>
      </div>

      <h2>{t('sr.rules', rules.length)}</h2>
      <dl className="legend">
        <dt>{t('sr.checkedT')}</dt><dd>{t('sr.checkedD')}</dd>
        <dt>{t('sr.approvedT')}</dt><dd>{t('sr.approvedD')}</dd>
        <dt>{t('sr.pendingT')}</dt><dd>{t('sr.pendingD')}</dd>
      </dl>
      <div className="table-scroll">
        <table className="stack">
          <thead>
            <tr>
              <th scope="col">{t('sr.requirement')}</th><th scope="col">{t('sr.srcTitle')}</th><th scope="col">{t('sr.supports')}</th>
              <th scope="col">{t('sr.status')}</th><th scope="col">{t('sr.lastVerified')}</th><th scope="col">{t('sr.owner')}</th><th scope="col">{t('sr.reviewer')}</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td data-label={t('sr.srcTitle')}><ExternalLink href={r.source.url}>{r.source.label}</ExternalLink><br /><span className="mono-small">{r.source.url}</span></td>
                <td data-label={t('sr.supports')}>{r.supports}{r.limits ? <><br /><em>{t('sr.limits')}{r.limits}</em></> : null}</td>
                <td data-label={t('sr.status')}>{statusLabel(r.verification, t)}<br /><span className="mono-small">{approvalLabel(r, t)}</span></td>
                <td data-label={t('sr.lastVerified')}>{r.lastVerified || t('sr.notVerified')}</td>
                <td data-label={t('sr.owner')}>{humanInput(r.owner || OWNER_FALLBACK, t.lang)}</td>
                <td data-label={t('sr.reviewer')}>{humanInput(r.reviewer || REVIEWER_FALLBACK, t.lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

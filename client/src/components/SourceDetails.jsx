import ExternalLink from './ExternalLink.jsx';
import { useT } from '../i18n.js';
import { statusLabel, approvalLabel, OWNER_FALLBACK, REVIEWER_FALLBACK } from './Parts.jsx';

// Provenance only: where the rule comes from and how far it has been reviewed.
// Explanations, conditions and timing live in the Guide.
export default function SourceDetails({ rule }) {
  const t = useT();
  const v = rule.verification || {};
  return (
    <details className="source-details">
      <summary>{t('src.summary')}</summary>
      <dl>
        {rule.agency && (<><dt>{t('src.agency')}</dt><dd>{rule.agency}</dd></>)}
        {rule.apply?.url && (
          <>
            <dt>{t('src.start')}</dt>
            <dd>
              <ExternalLink href={rule.apply.url} showFallback fallback={rule.fallback}>{rule.apply.label || t('src.openAgency')}</ExternalLink>
            </dd>
          </>
        )}
        <dt>{t('src.title')}</dt><dd>{rule.source.label}</dd>
        <dt>{t('src.url')}</dt>
        <dd className="mono"><ExternalLink href={rule.source.url}>{rule.source.url}</ExternalLink></dd>
        {rule.supports && (<><dt>{t('src.supports')}</dt><dd>{rule.supports}</dd></>)}
        <dt>{t('src.last')}</dt><dd>{rule.lastVerified || t('sr.notVerified')}</dd>
        <dt>{t('src.status')}</dt><dd>{statusLabel(v, t)}{v.note && v.note.toLowerCase().startsWith(statusLabel(v, t).toLowerCase()) ? v.note.slice(statusLabel(v, t).length) : v.note ? `. ${v.note}` : ''}</dd>
        <dt>{t('src.approval')}</dt><dd>{approvalLabel(rule, t)}</dd>
        <dt>{t('src.owner')}</dt><dd>{rule.owner || OWNER_FALLBACK}</dd>
        <dt>{t('src.reviewer')}</dt><dd>{rule.reviewer || REVIEWER_FALLBACK}</dd>
      </dl>
    </details>
  );
}

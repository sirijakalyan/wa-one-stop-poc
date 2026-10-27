import ExternalLink from './ExternalLink.jsx';
import { statusLabel, approvalLabel, OWNER_FALLBACK, REVIEWER_FALLBACK } from './Parts.jsx';

// Provenance only: where the rule comes from and how far it has been reviewed.
// Explanations, conditions and timing live in the Guide.
export default function SourceDetails({ rule }) {
  const v = rule.verification || {};
  return (
    <details className="source-details">
      <summary>Source details</summary>
      <dl>
        {rule.agency && (<><dt>Agency</dt><dd>{rule.agency}</dd></>)}
        {rule.apply?.url && (
          <>
            <dt>Where to start</dt>
            <dd>
              <ExternalLink href={rule.apply.url} showFallback fallback={rule.fallback}>{rule.apply.label || 'Open the agency page'}</ExternalLink>
            </dd>
          </>
        )}
        <dt>Source title</dt><dd>{rule.source.label}</dd>
        <dt>Official URL</dt>
        <dd className="mono"><ExternalLink href={rule.source.url}>{rule.source.url}</ExternalLink></dd>
        {rule.supports && (<><dt>What it supports</dt><dd>{rule.supports}</dd></>)}
        <dt>Last verified</dt><dd>{rule.lastVerified || 'Not yet verified'}</dd>
        <dt>Status</dt><dd>{statusLabel(v)}{v.note ? `. ${v.note}` : ''}</dd>
        <dt>Approval</dt><dd>{approvalLabel(rule)}</dd>
        <dt>Owner</dt><dd>{rule.owner || OWNER_FALLBACK}</dd>
        <dt>Reviewer</dt><dd>{rule.reviewer || REVIEWER_FALLBACK}</dd>
      </dl>
    </details>
  );
}

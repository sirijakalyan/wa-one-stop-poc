// Grounded Q&A over the rule records. No Node imports: this file also runs in the browser preview.
//
// Rules of this module:
//  1. Every sentence of an answer is copied from a rule record (title, guide, facts, status).
//  2. Every link comes from a rule record (apply, source, fact source). Nothing is invented.
//  3. An optional LLM may only reword the grounded text. Its output is discarded if it adds
//     a link, a number or a dollar amount that is not in the grounded text.
//  4. The chat never decides whether a requirement applies to someone. It points to the checklist.

const STOP = new Set(('a an and are as at be but by can do does for from get has have how i if in is it its me my need needs of on or our so ' +
  'that the their there this to us was we what when where which who will with would you your about any also some tell please should could').split(' '));

// Retrieval aids only. These words help match a question to a record. They are not facts.
const SYNONYMS = {
  sos: ['llc', 'corporation', 'partnership', 'llp', 'entity', 'secretary', 'state', 'form', 'formation', 'incorporate', 'register'],
  dor: ['license', 'licence', 'ubi', 'revenue', 'dor', 'endorsement', 'endorsements', 'business', 'apply', 'sales', 'tax', 'trade', 'name', 'income', 'earn', 'gross', '12000', 'threshold'],
  wizard: ['wizard', 'licensing', 'confirm', 'list'],
  'lni-contractor': ['contractor', 'construction', 'bond', 'trades', 'plumber', 'electrician', 'builder', 'contracting'],
  health: ['food', 'restaurant', 'health', 'permit', 'county', 'kitchen', 'cafe', 'catering'],
  'lni-wc': ['workers', 'compensation', 'comp', 'insurance', 'injury', 'coverage', 'li', 'l&i', 'labor', 'industries'],
  esd: ['unemployment', 'employer', 'quarterly', 'reports', 'employment', 'security', 'esd', 'payroll', 'wages'],
  dshs: ['hire', 'hires', 'hiring', 'child', 'support', 'dshs', 'employee', 'employees', 'new'],
  ic: ['independent', 'subcontractor', 'subcontractors', 'freelancer', '1099', 'contractors'],
  local: ['city', 'county', 'local', 'zoning', 'municipal', 'endorsement'],
};

const stem = (w) => w.replace(/'s$/, '').replace(/(ing|ed|es|s)$/, (m) => (w.length > 5 ? '' : m));
const tokens = (text) => String(text).toLowerCase().replace(/[^a-z0-9&' ]+/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem);

function ruleText(r) {
  const g = r.guide || {};
  return [r.title, r.agency, r.detail, r.supports, g.meaning, ...(g.who || []), ...(g.conditions || []), ...(g.steps || []).map((s) => s.text),
    ...(g.facts || []).map((f) => `${f.label} ${f.text}`)].filter(Boolean).join(' ');
}

// Fix small typos ("lisence", "contracter") by matching to a word the records use. Retrieval aid only.
function editDistanceOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; let j = 0; let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
function fixTypos(words, vocab) {
  return words.map((w) => {
    if (w.length < 5 || vocab.has(w)) return w;
    for (const v of vocab) if (v.length >= 5 && editDistanceOne(w, v)) return v;
    return w;
  });
}

function scoreRules(rules, query) {
  const vocab = new Set(rules.flatMap((r) => [...tokens(ruleText(r)), ...(SYNONYMS[r.id] || []).map(stem)]));
  const q = fixTypos(tokens(query), vocab);
  if (!q.length) return [];
  const sets = rules.map((r) => ({
    rule: r,
    title: new Set(tokens(`${r.title} ${r.agency}`)),
    body: new Set(tokens(ruleText(r))),
    syn: new Set((SYNONYMS[r.id] || []).map(stem)),
  }));
  const level = (x, w) => (x.title.has(w) ? 4 : x.syn.has(w) ? 3 : x.body.has(w) ? 1 : 0);
  // A word that matches few records says more than one that matches many.
  const df = Object.fromEntries(q.map((w) => [w, sets.filter((x) => level(x, w) > 0).length || 1]));
  // Retrieval hints for phrases where a generic word would otherwise win. Not facts.
  const boost = (id) => (/\bunemployment\b/i.test(query) && id === 'esd' ? 6 : 0);
  return sets.map((x) => ({
    rule: x.rule,
    score: q.reduce((sum, w) => sum + level(x, w) * (1 + 1 / df[w]), 0) + boost(x.rule.id),
  })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}

const isHttps = (u) => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u);
function linksFor(rule, extra = []) {
  const out = [];
  const add = (label, url) => { if (isHttps(url) && !out.some((l) => l.url === url)) out.push({ label, url }); };
  if (rule.apply?.url) add(rule.apply.label || 'Start this step', rule.apply.url);
  if (rule.source?.url) add(`Source: ${rule.source.label}`, rule.source.url);
  for (const f of extra) if (f.source?.url) add(`Source: ${f.source.label}`, f.source.url);
  return out;
}

const pending = (r) => r.verification?.status === 'pending';
const statusLine = (r) => (pending(r)
  ? `Pending verification: ${r.guide?.pendingNote || 'this requirement is not confirmed in this demo.'} Confirm it with the relevant agency.`
  : `Source checked${r.lastVerified ? ` on ${r.lastVerified}` : ''}. Not yet Approved by a named reviewer. Confirm with the agency.`);

const wants = {
  money: /\b(fee|fees|cost|costs|price|pay|how much|bond|amount|dollar)\b|\$/i,
  time: /\b(how long|processing|process time|takes?|days|weeks|timeline|turnaround|deadline|when)\b/i,
  steps: /\b(how (do|can|to)|steps?|apply|process|start|register|file|sign up)\b/i,
  who: /\b(who|need|required|do i have to|must|apply to me|exempt|exception|condition)\b/i,
  link: /\b(link|url|website|site|page|where)\b/i,
};

function describeRule(rule, message) {
  const g = rule.guide || {};
  const lines = [`${rule.title} (${rule.agency}).`];
  const facts = g.facts || [];
  let usedFacts = [];

  const askMoney = wants.money.test(message);
  const askTime = wants.time.test(message);
  if (askMoney || askTime) {
    usedFacts = facts.filter((f) => {
      const t = `${f.label} ${f.text}`;
      return (askMoney && /fee|cost|\$|bond|insurance|amount/i.test(t)) || (askTime && /time|process|day|week|deadline|month/i.test(t));
    });
    if (usedFacts.length) {
      for (const f of usedFacts.slice(0, 4)) {
        lines.push(`${f.label}: ${f.text}${f.status === 'needs-verification' ? ' (Needs verification)' : ''} Checked ${f.asOf}.`);
      }
      lines.push('These are the agency\'s own statements and estimates. Confirm with the agency.');
    } else {
      lines.push('I don\'t have a verified fee or timing for this step in the current rules/guides.');
    }
  } else if (!NEED_Q.test(message) && wants.steps.test(message) && (g.steps || []).length) {
    lines.push('Steps:');
    g.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.text}`));
  } else if (wants.who.test(message) && (g.who || []).length) {
    lines.push(`Who it applies to: ${g.who.join(' ')}`);
    if ((g.conditions || []).length) lines.push(`Conditions: ${g.conditions.slice(0, 3).join(' ')}`);
  } else {
    if (g.meaning) lines.push(g.meaning);
    if ((g.who || []).length) lines.push(`Who it applies to: ${g.who.slice(0, 2).join(' ')}`);
  }
  lines.push(statusLine(rule));
  return { text: lines.join('\n'), usedFacts };
}

export function topicList(rules) {
  return rules.map((r) => r.title);
}

// Topics this demo has no rule or guide for. Saying so is better than matching a nearby rule by a shared word like "register".
const OUT_OF_SCOPE = /\b(trade ?marks?|patents?|copyrights?|visas?|immigration|green card|annual report|weather|stock|invest(ing|ment)?|bankrupt(cy)?|divorce|lawsuit|sue)\b/i;
function outOfScope() {
  return {
    answer: "That is outside what this demo covers. I only use the written rules and guides in this app, and none of them cover that topic. Please ask the relevant agency, or try the Sources page. I can help with the business license, Secretary of State filing, contractor registration, workers' compensation, employer taxes, new hire reporting and county health permits.",
    links: [], matched: [], mode: 'fallback',
    suggestions: ['How do I get started?', 'Do I need a business license?', 'What is my next step?'],
  };
}

function fallback(rules) {
  const topics = ['business license', 'Secretary of State filing', 'contractor registration', 'workers\' compensation', 'employer taxes', 'new hire reporting', 'county health permit'];
  void rules;
  return {
    answer: `I don't have that in the current rules/guides. Try asking about ${topics.slice(0, 6).join(', ')}, or check the Sources page.`,
    links: [], matched: [], mode: 'fallback',
    suggestions: ['How do I get started?', 'Do I need a business license?', 'What is my next step?'],
  };
}

const NO_SCENARIO = 'No business is selected yet, so I can\'t personalize your steps. Choose a sample business or complete the questionnaire to get a checklist for your business. I can still answer general questions about any step.';

function checklistAnswer(checklist) {
  if (!checklist?.saved) {
    return { answer: NO_SCENARIO, links: [], matched: [], mode: 'grounded', suggestions: ['How do I get started?', 'Do I need a business license?'] };
  }
  const lines = [`Your checklist has ${checklist.items.length} steps. ${checklist.items.filter((i) => i.done).length} marked done (simulated tracking).`];
  checklist.items.forEach((i, n) => {
    const label = i.verification?.status === 'pending' ? 'Pending verification' : i.status === 'applies' ? 'Applies to you' : 'May apply, confirm';
    lines.push(`${n + 1}. ${i.title} (${label})${i.done ? ', marked done' : ''}`);
  });
  const next = checklist.items.find((i) => !i.done);
  const links = [];
  if (next) {
    lines.push(`Next step: ${next.title}.`);
    if (isHttps(next.apply?.url)) links.push({ label: next.apply.label || 'Start this step', url: next.apply.url });
  }
  return { answer: lines.join('\n'), links, matched: next ? [{ id: next.id, title: next.title }] : [], mode: 'grounded' };
}

const START = /\b(how (do|to|can|should) (i |we )?(start|begin|open|launch|set ?up|get started)|where (do|should|can) (i|we) (start|begin)|get(ting)? started|first step|start(ing)? (a|my|the) (business|company)|open(ing)? (a|my) business|know (anything|nothing)|new to (this|business))\b|\bhow to start\b|\bstart\b.*\b(tell|explain|help)\b/i;
const OVERVIEW = /\b(list (of )?(all|every|the)|all (the )?(steps|requirements|agencies)|every step|overview|summary|summari[sz]e|everything|whole process|big picture|which agencies|what agencies|what steps|which steps|how many steps|the steps( clearly)?|what does this (app|tool|site)|what is this (app|tool|site))\b/i;

function orderedRules(rules) {
  return [...rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function startAnswer(rules, checklist) {
  const list = orderedRules(rules);
  const first = list[0];
  const lines = ['A good way to begin, in the order this app uses:'];
  list.slice(0, 3).forEach((r, i) => lines.push(`${i + 1}. ${r.title} (${r.agency})`));
  if (list.length > 3) lines.push(`Other steps depend on your business: ${list.slice(3).map((r) => r.title).join('; ')}.`);
  lines.push(checklist?.saved
    ? 'You already have a checklist. Ask "what is my next step?" to see where you are.'
    : 'Not every step applies to every business. Choose a sample business or complete the questionnaire to get your own checklist.');
  lines.push('Each step is Source checked with a date or Pending verification. Confirm with the agency.');
  return {
    answer: lines.join('\n'),
    links: linksFor(first).slice(0, 1),
    matched: first ? [{ id: first.id, title: first.title }] : [],
    mode: 'grounded',
    suggestions: ['What is the first step?', 'Do I need a business license?', 'What is my next step?'],
  };
}

const HELP_ME = /\b(guide me|help me|walk me through|what should i do|what do i do|where do i go|show me around|explain (this|it|everything)|assist me)\b|^(help|guide)\b/i;
const THANKS = /^(thanks?|thank you|thx|ok(ay)?|great|cool|got it|nice|perfect|awesome)\b[\s!.]*$/i;
const BYE = /^(bye|goodbye|see you|that'?s all|no thanks?)\b/i;

// Short, topic-less "how" asks. They only make sense about a step already in play.
const VAGUE_HOW = /^(how( to| do i| can i| should i)?( do| proceed| apply| start| begin| go)?( this| it| that)?( step)?|steps?|what are the steps|what('s| is| are) the steps( for (this|it|that))?|how do i do (this|it|that)( step)?|what now|then what|explain( this| it| that)?|tell me more|more (details|info)|go on|and then)[\s?.!]*$/i;

// The step the visitor is talking about: the last user turn that clearly names a rule, else the first undone checklist step.
function currentTopic(rules, conversation, checklist) {
  for (const t of [...conversation].reverse()) {
    if (typeof t?.content !== 'string') continue;
    if (t.role === 'assistant') {
      const r = focusFrom(t.content, rules);
      if (r) return r;
      continue;
    }
    if (t.role !== 'user') continue;
    const hit = scoreRules(rules, t.content)[0];
    if (hit && hit.score >= 3) return hit.rule;
  }
  const next = checklist?.saved ? checklist.items.find((i) => !i.done) : null;
  return next ? rules.find((r) => r.id === next.id) || null : null;
}


const FULL_LIST = /\b(show|see|give|list|display|print|read)\b.*\b(full|whole|entire|complete|all|my)\b.*\b(checklist|list|steps)\b|\b(full|whole|entire|complete) (checklist|list)\b|\ball (of )?(my |the )?steps\b|\bshow (me )?(my )?checklist\b|\bmy checklist\b$/i;
const AFTER = /\bafter\s+(.+?)(?:[,?.!]|\s+(?:what|then|which|where|how|do|should|whats)\b|$)/i;
const NEXT_Q = /\b(next|then|after that|what now|what to do|what should i do|what do i do|do next|what('s| is) left|remaining)\b/i;
const CHAIN = /^(and )?(then what|and then|after that|what after that|what then|what('s| is) after that|what('s| is) next|what next|next|ok(ay)? (and )?(then|next)|then)[\s?.!]*$/i;

const firstSentence = (t, max = 190) => {
  const m = String(t || '').match(/^.*?[.!?](?=\s|$)/);
  const x = (m ? m[0] : String(t || '')).trim();
  return x.length > max ? `${x.slice(0, max - 1).trim()}.` : x;
};
const stepLabel = (i) => (i.verification?.status === 'pending' ? 'Pending verification' : i.status === 'applies' ? 'Applies to you' : 'May apply, confirm');

// Short, direct answer: the next not-done step after an optional anchor step, plus up to two more. Never the whole list.
const PRONOUN = /^(that|it|this|that one|this one|those|them|the (previous|last) (one|step))$/i;
const FIRST_Q = /\b(first step|what (do|should) i do first|what('s| is) (my|the) first)\b/i;
const NEXT_THE = /\bnext step\b|\bwhat('s| is) next\b/i;
const AFTER_THAT = /\bafter that\b|\bwhat (comes|happens) (next|then|after)\b|\bthen what\b|\band then\b/i;
const isChainLike = (m) => CHAIN.test(m.trim()) || (m.trim().split(/\s+/).length <= 9 && AFTER_THAT.test(m));

// The step the visitor is asking "after" or "next" about. A named step wins. Otherwise "that", "next", "and then" and
// "what is the next step" continue from the step the chat last pointed to. "my next step" has no anchor.
function resolveAnchor({ message, rules, conversation }) {
  const am = AFTER.exec(message);
  if (am && !PRONOUN.test(am[1].trim())) {
    const hit = scoreRules(rules, am[1])[0];
    return hit && hit.score >= 3 ? hit.rule : null;
  }
  const contextual = Boolean(am) || isChainLike(message) || (NEXT_THE.test(message) && !/\bmy\b/i.test(message));
  if (!contextual) return null;
  return focusFrom(lastAssistantText(conversation), rules) || currentTopic(rules, conversation, null);
}

function nextStepsAnswer({ rules, checklist, anchorRule = null }) {
  const items = checklist.items;
  const anchor = anchorRule ? items.find((i) => i.id === anchorRule.id) || null : null; // the step already discussed
  const idx = anchor ? items.indexOf(anchor) : -1;
  const lines = [];
  if (anchorRule && !anchor) lines.push(`"${anchorRule.title}" is not on your checklist based on your answers, so here is your next open step.`);
  const queue = anchor ? items.slice(idx + 1).filter((i) => !i.done) : items.filter((i) => !i.done);
  if (!queue.length) {
    const earlier = anchor ? items.slice(0, idx).filter((i) => !i.done) : [];
    let text;
    if (anchor && idx === items.length - 1) text = `"${anchor.title}" is the last step on your checklist, so nothing comes after it.`;
    else if (anchor) text = `Every step after "${anchor.title}" is already marked done (simulated tracking).`;
    else text = 'No steps are left open on your checklist (done marks are simulated tracking).';
    if (earlier.length) text += `\nStill open earlier on your list: ${earlier.slice(0, 2).map((i) => i.title).join('; ')}.`;
    return { answer: `${text}\nConfirm each requirement with its agency.`, links: [], matched: anchor ? [{ id: anchor.id, title: anchor.title }] : [], mode: 'grounded', suggestions: ['Show my full checklist', 'What is still pending?'] };
  }
  const next = queue[0];
  const nextRule = rules.find((r) => r.id === next.id);
  if (anchor) lines.push(`After "${anchor.title}"${anchor.done ? ' (marked done)' : ''}, your next step is:`);
  lines.push(`Next step: ${next.title}. (${stepLabel(next)})`);
  const why = firstSentence(nextRule?.guide?.meaning) || firstSentence(next.reason);
  if (why) lines.push(why);
  if (/\bselected\b/i.test(next.reason || '')) lines.push(firstSentence(next.reason, 260));
  if (next.verification?.status === 'pending') {
    lines.push(`Pending verification: ${nextRule?.guide?.pendingNote || 'this requirement is not confirmed in this demo.'} Confirm it with the relevant agency.`);
  }
  const links = [];
  if (isHttps(next.apply?.url)) links.push({ label: next.apply.label || 'Start this step', url: next.apply.url });
  else if (next.verification?.status !== 'pending') lines.push('There is no verified link for this step in the current rules.');
  const more = queue.slice(1, 3);
  if (more.length) lines.push(`After that: ${more.map((i) => `${i.title}${i.verification?.status === 'pending' ? ' (Pending verification)' : ''}`).join('; ')}.`);
  lines.push('Ask "show my full checklist" to see every step.');
  return {
    answer: lines.join('\n'), links, matched: [{ id: next.id, title: next.title }], mode: 'grounded',
    suggestions: ['How do I do this step?', 'What comes after that?', 'Show my full checklist'],
  };
}

function ruleOrderAnswer({ rules, message, anchorRule = null }) {
  const am = AFTER.exec(message);
  const hit = anchorRule ? { rule: anchorRule, score: 99 } : am && scoreRules(rules, am[1])[0];
  if (!hit || hit.score < 3) return null;
  const list = orderedRules(rules);
  const next = list[list.findIndex((r) => r.id === hit.rule.id) + 1];
  if (!next) {
    return { answer: `"${hit.rule.title}" is the last step in this app's general order, so nothing comes after it. Choose a sample business or complete the questionnaire to see which steps apply to your business.`, links: [], matched: [{ id: hit.rule.id, title: hit.rule.title }], mode: 'grounded', suggestions: ['How do I get started?'] };
  }
  const lines = [`After "${hit.rule.title}", the usual next step is:`, `Next in order: ${next.title}. (${next.agency})`];
  const why = firstSentence(next.guide?.meaning);
  if (why) lines.push(why);
  if (pending(next)) lines.push(`Pending verification: ${next.guide?.pendingNote || 'this requirement is not confirmed in this demo.'} Confirm it with the relevant agency.`);
  lines.push('This is the general order. Choose a sample business or complete the questionnaire to see which steps apply to your business.');
  return {
    answer: lines.join('\n'), links: linksFor(next).slice(0, 1), matched: [{ id: next.id, title: next.title }], mode: 'grounded',
    suggestions: ['What comes after that?', 'How do I do this step?', 'Guide me through it'],
  };
}

// ---- Step-by-step guidance. Text comes only from the rule's own guide; nothing is filled in or submitted. ----
const GUIDE_ASK = /\b(guide me|walk me through|step by step|take me through|show me how|help me (fill|apply|complete|with)|(how|can you|could you).{0,30}\b(fill|complete)\b|fill (it |this |that )?(out|in))\b/i;
const FORM_WORD = /\b(fill|form|application|apply)\b/i;
const GUIDE_NEXT = /^(next( step)?|done|i did (it|that)|i('ve| have) done (it|that)|finished|ok(ay)?( next)?|continue|go on|ready|got it|yes)[\s?.!]*$/i;
const GUIDE_WORDS = /\b(can|could|would|you|please|guide|walk|take|help|me|us|through|how|to|do|i|fill|out|in|step|by|the|a|an|this|that|it|with|my|form|application|show|explain|and|then|start|need|want)\b/gi;

const fillable = (r) => Boolean(r?.apply?.url && (r.guide?.steps || []).length);
const byTitle = (rules, t) => rules.find((r) => r.title === t) || null;
function lastAssistantText(conversation) {
  const t = [...conversation].reverse().find((x) => x?.role === 'assistant' && typeof x.content === 'string');
  return t ? t.content : '';
}
const focusFrom = (text, rules) => {
  const m = /Step \d+ of \d+ \((.+?)\): /.exec(text) || /(?:Next step|Next in order): (.+?)\. \(/.exec(text);
  return m ? byTitle(rules, m[1]) : null;
};
const anchorFrom = (text, rules) => {
  const m = /^After "(.+?)"/.exec(text);
  return m ? byTitle(rules, m[1]) : null;
};

function guideStep(rule, k) {
  const g = rule.guide || {};
  const steps = g.steps || [];
  const n = steps.length;
  const step = steps[k - 1];
  const lines = [];
  if (k === 1) {
    lines.push(`Let's go through "${rule.title}" one step at a time. I can't fill in or submit anything for you. You do that on the agency's own site.`);
    const prep = (g.prepare || []).map((x) => (typeof x === 'string' ? x : x?.text)).filter(Boolean);
    if (prep.length) lines.push(`Have ready: ${prep.join('; ')}.`);
    else if (g.prepareNote) lines.push(g.prepareNote);
  }
  lines.push(`Step ${k} of ${n} (${rule.title}): ${step.text}`);
  const links = [];
  if ((k === 1 || step.external) && isHttps(rule.apply?.url)) links.push({ label: rule.apply.label || 'Start this step', url: rule.apply.url });
  if (k === 1) lines.push(statusLine(rule));
  lines.push(k < n ? `Say "next" when you are ready for step ${k + 1}.` : 'That is the last step. Confirm everything with the agency.');
  return { answer: lines.join('\n'), links, matched: [{ id: rule.id, title: rule.title }], mode: 'grounded', suggestions: k < n ? ['Next', 'What is my next step?'] : ['What is my next step?'] };
}

function clarifyForm(options, rules) {
  const names = options.map((r) => `"${r.title}"`);
  return {
    answer: `Which one do you mean: ${names.join(' or ')}? Pick one and I will guide you one step at a time.`,
    links: [], matched: options.map((r) => ({ id: r.id, title: r.title })), mode: 'grounded',
    suggestions: options.map((r) => `Guide me through ${r.title}`),
  };
  void rules;
}

function guideAnswer({ message, conversation, rules, checklist }) {
  const stripped = message.replace(GUIDE_WORDS, ' ').replace(/\s+/g, ' ').trim();
  const named = stripped.length >= 3 ? scoreRules(rules, stripped)[0] : null;
  if (named && named.score >= 5 && fillable(named.rule)) return guideStep(named.rule, 1);
  if (named && named.score >= 5) return guideStep({ ...named.rule, apply: named.rule.apply }, 1);
  const last = lastAssistantText(conversation);
  const focus = focusFrom(last, rules);
  const anchor = anchorFrom(last, rules);
  const formAsk = FORM_WORD.test(message);
  if (formAsk && focus && anchor && anchor.id !== focus.id && fillable(focus) && fillable(anchor)) return clarifyForm([anchor, focus], rules);
  const target = focus || currentTopic(rules, conversation, checklist);
  if (target && (target.guide?.steps || []).length) return guideStep(target, 1);
  if (formAsk) {
    const opts = ['dor', 'wizard', 'sos'].map((id) => rules.find((r) => r.id === id)).filter(Boolean);
    if (opts.length) return clarifyForm(opts, rules);
  }
  return null;
}

function guideAdvance(conversation, rules) {
  const last = lastAssistantText(conversation);
  const m = /Step (\d+) of (\d+) \((.+?)\): /.exec(last);
  const rule = m && byTitle(rules, m[3]);
  if (!rule) return null;
  const k = Number(m[1]);
  const n = Number(m[2]);
  if (k < n) return guideStep(rule, k + 1);
  return {
    answer: `That was the last step for "${rule.title}". Confirm it with the agency, then mark it done on your checklist if you are using one. Ask "what is my next step?" when you are ready to move on.`,
    links: [], matched: [{ id: rule.id, title: rule.title }], mode: 'grounded', suggestions: ['What is my next step?'],
  };
}

// ---- Extra conversation intents (capabilities, limits, progress, pending, hiring, repeat) ----
const CAPS = /\bwhat can you (help|do)\b|\bhow can you help\b|\bwhat do you do\b|\bwhat are you\b/i;
const SUBMIT_FOR_ME = /\b(submit|file|apply|register|sign me up|sign up|pay|fill (it |this |that )?(in|out)|send)\b.{0,40}\bfor me\b|\b(can|could|will|would) you (submit|file|apply|register|pay|send|do (it|that|this) for me)\b/i;
const GUARANTEE = /\b(guarantee|guaranteed|promise|100 ?%|every legal requirement|fully compliant|legally safe|sure i('m| am) (compliant|legal)|legal advice|lawyer|attorney)\b|\bmeets? (all|every) (legal )?requirement/i;
const WHICH = /\b(which (one|should i|do i)|what('s| is) the difference|which is (better|first|right|correct))\b/i;
const REPEAT = /\b(explain|repeat|say|tell me|show)\b.{0,25}\b(again|once more)\b|\bagain\b|\bi (don'?t|do not) (understand|get)\b|\bwhat do you mean\b|\bcan you (clarify|rephrase)\b|^explain (that|this|it)( step)?[\s?.!]*$/i;
const PENDING_Q = /\b(pending|unverified|not (yet )?(verified|confirmed)|still (open|pending)|needs? verification)\b/i;
const APPROVED_Q = /\b(all|every|everything)\b.{0,40}\b(approved|verified|confirmed|certified)\b|\b(is|are)\b.{0,30}\b(approved|certified)\b/i;
const INCOMPLETE_Q = /\b(incomplete|not (yet )?(done|completed|finished)|remaining|still (left|to do|need)|what('s| is) left|left to do|unfinished|outstanding)\b/i;
const DONE_Q = /\b(already (completed|done|finished)|what (have|did) i (completed|done|finish)|completed (so far|tasks|steps)|what('s| is) (done|completed)|marked (as )?done|what i('ve| have) (done|completed))\b/i;
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 };
const COMPLETED_N = /\b(completed|finished|done( with)?|did)\b.{0,20}\b(first |1st |top )?(one|two|three|four|five|six|seven|\d)\s*(steps?|tasks?)\b/i;
const HIRE = /\b(employees?|hire|hiring|staff|payroll)\b/i;
const HIRE_NOT = /\b(subcontractors?|independent|freelancers?|contractors?|report|new hires?|workers|compensation|tax|taxes|unemployment|child support|fee|how long|link)\b/i;
const NEED_Q = /\b(do i (need|have to)|am i required|is (it|this|that|a|an|the) .{0,40}required|must i)\b/i;
const DEFINITE = /\b(definitely|for sure|certain(ly)?|exactly|always|guaranteed|absolutely|really required)\b/i;

const pendingRules = (rules, checklist) => (checklist?.saved
  ? checklist.items.filter((i) => i.verification?.status === 'pending').map((i) => ({ id: i.id, title: i.title }))
  : rules.filter(pending).map((r) => ({ id: r.id, title: r.title })));

function capabilitiesAnswer() {
  return {
    answer: 'I can explain each step in this app: what it is, who it applies to, the official link, and fees or timing when they are recorded. I can tell you your next step from your checklist and guide you through a step one instruction at a time.\nI can\'t fill in, submit or pay for anything, I can\'t check with an agency for you, and this is not legal advice. Each step is either "Source checked" with a date or Pending verification. Confirm everything with the agency.',
    links: [], matched: [], mode: 'grounded',
    suggestions: ['How do I get started?', 'What is my next step?', 'Do I need a business license?'],
  };
}

function limitAnswer(kind, rules, checklist, message) {
  if (kind === 'submit') {
    const hit = scoreRules(rules, message.replace(/\b(can|could|will|would|you|submit|file|apply|register|pay|send|for|me|my|the|please|it|that|this)\b/gi, ' '))[0];
    const rule = hit && hit.score >= 3 ? hit.rule : null;
    const links = rule ? linksFor(rule).slice(0, 1) : [];
    return {
      answer: `No. I can't submit, fill in, pay for or file anything for you, and I can't check with an agency for you.${rule ? ` For "${rule.title}", you do it yourself on the agency's own site. The official link is below.` : ' You do it yourself on the agency\'s own site.'} I can explain the steps and guide you through them one at a time.`,
      links, matched: rule ? [{ id: rule.id, title: rule.title }] : [], mode: 'grounded', suggestions: ['Guide me through it', 'How do I get started?'],
    };
  }
  const pend = pendingRules(rules, checklist);
  return {
    answer: `No, I can't guarantee that. This demo is not legal advice and nothing in it is Approved by a named reviewer yet. Each step is either "Source checked" with a date or Pending verification, and other requirements may exist that this demo does not list.${pend.length ? ` ${checklist?.saved ? 'On your checklist' : 'In this app'}, ${pend.length} step${pend.length === 1 ? ' is' : 's are'} Pending verification.` : ''} Confirm every requirement with the relevant agency, and ask a lawyer if you need legal advice.`,
    links: [], matched: [], mode: 'grounded', suggestions: ['What is still pending?', 'What is my next step?'],
  };
}

function pendingAnswer(rules, checklist, approved) {
  const list = pendingRules(rules, checklist);
  const lines = [];
  if (approved) lines.push('No. Nothing in this demo is Approved by a named reviewer yet. Each step is either "Source checked" with a date, or Pending verification.');
  if (!list.length) lines.push(checklist?.saved ? 'None of your checklist steps are Pending verification. Confirm each one with its agency.' : 'No step is Pending verification right now.');
  else {
    lines.push(checklist?.saved ? `${list.length} of your ${checklist.items.length} steps ${list.length === 1 ? 'is' : 'are'} Pending verification:` : 'In this app, these steps are Pending verification:');
    list.forEach((x) => lines.push(`- ${x.title}`));
    lines.push('Pending verification means the requirement is not confirmed in this demo, and I have no verified link or fee for it. Confirm each with the relevant agency.');
  }
  if (!checklist?.saved) lines.push('Choose a sample business or complete the questionnaire to see which apply to you.');
  return { answer: lines.join('\n'), links: [], matched: list.slice(0, 3), mode: 'grounded', suggestions: ['What is my next step?', 'Show my full checklist'] };
}

function progressAnswer(kind, checklist) {
  const items = checklist.items;
  const done = items.filter((i) => i.done);
  const todo = items.filter((i) => !i.done);
  const mark = (i) => `- ${i.title} (${stepLabel(i)})`;
  const lines = [];
  if (kind === 'done') {
    if (!done.length) lines.push('You have not marked any step as done yet. Marking is your own simulated tracking.');
    else { lines.push(`You have marked ${done.length} of ${items.length} steps done (simulated tracking):`); done.forEach((i) => lines.push(`- ${i.title}`)); }
  } else if (!todo.length) lines.push('Every step on your checklist is marked done (simulated tracking). Confirm each requirement with its agency.');
  else { lines.push(`${todo.length} of ${items.length} steps are still open:`); todo.forEach((i) => lines.push(mark(i))); }
  if (todo[0]) lines.push(`Your next step is: ${todo[0].title}.`);
  return { answer: lines.join('\n'), links: [], matched: todo[0] ? [{ id: todo[0].id, title: todo[0].title }] : [], mode: 'grounded', suggestions: ['What is my next step?', 'Show my full checklist'] };
}

function hireAnswer(rules, checklist) {
  const ids = ['lni-wc', 'esd', 'dshs'];
  const lines = [];
  const links = [];
  let matched = [];
  if (checklist?.saved) {
    const mine = ids.map((id) => checklist.items.find((i) => i.id === id)).filter(Boolean);
    if (!mine.length) {
      lines.push('Your checklist has no employee steps, based on your answers. If you plan to hire, edit your answers to see them.');
    } else {
      lines.push('For employees, your checklist has these steps:');
      for (const i of mine) {
        lines.push(`- ${i.title} (${stepLabel(i)})${i.done ? ', marked done' : ''}`);
        if (!i.done && isHttps(i.apply?.url) && links.length < 3) links.push({ label: i.apply.label || i.title, url: i.apply.url });
      }
      lines.push('Pending verification means the requirement is not confirmed in this demo. Confirm each with the agency.');
      matched = mine.map((i) => ({ id: i.id, title: i.title }));
    }
  } else {
    const rs = ids.map((id) => rules.find((r) => r.id === id)).filter(Boolean);
    lines.push('If you hire, these steps may matter:');
    for (const r of rs) {
      lines.push(`- ${r.title} (${r.agency})${pending(r) ? ' (Pending verification)' : ''}`);
      if (isHttps(r.apply?.url) && links.length < 3) links.push({ label: r.apply.label || r.title, url: r.apply.url });
    }
    lines.push('Choose a sample business or complete the questionnaire to see which apply to you. Confirm each with the agency.');
    matched = rs.map((r) => ({ id: r.id, title: r.title }));
  }
  return { answer: lines.join('\n'), links, matched, mode: 'grounded', suggestions: ['What is my next step?', 'How do I report new hires?'] };
}

function whichAnswer(last, rules) {
  const titles = [...last.matchAll(/"(.+?)"/g)].map((m) => m[1]);
  const opts = titles.map((t) => byTitle(rules, t)).filter(Boolean).slice(0, 3);
  if (opts.length < 2) return null;
  const lines = ['Here is the difference:'];
  for (const r of opts) lines.push(`- "${r.title}": ${firstSentence(r.guide?.meaning, 160)}`);
  const dor = opts.find((r) => r.id === 'dor');
  const wiz = opts.find((r) => r.id === 'wizard');
  const dorStep = dor?.guide?.steps?.find((st) => /wizard/i.test(st.text));
  if (dor && wiz && dorStep) lines.push(`The license guide itself says: "${dorStep.text}" So the wizard is the tool that tells you what to apply for.`);
  lines.push('Pick one and I will guide you one step at a time.');
  return { answer: lines.join('\n'), links: [], matched: opts.map((r) => ({ id: r.id, title: r.title })), mode: 'grounded', suggestions: opts.map((r) => `Guide me through ${r.title}`) };
}

const GREETING = /^(hi|hello|hey|help|what can you do|who are you|start)\b/i;
const MINE = /\b(my (checklist|list|steps|progress)|next steps?|what('s| is) next|what should i do (first|next)|what do i (do|need) (first|next))\b/i;

const nums = (t) => (String(t).match(/\$?\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]$/, ''));
const urls = (t) => String(t).match(/https?:\/\/[^\s)]+/gi) || [];

// Accept the LLM rewrite only if it adds no new link or number.
export function acceptRewrite(rewrite, grounded, allowedUrls) {
  if (typeof rewrite !== 'string' || !rewrite.trim() || rewrite.length > 1800) return false;
  if (urls(rewrite).some((u) => !allowedUrls.includes(u.replace(/[.,;]+$/, '')))) return false;
  const known = new Set(nums(grounded));
  if (nums(rewrite).some((n) => !known.has(n))) return false;
  if (/—|–/.test(rewrite)) return false;
  if (/\b(guarantee[sd]?|certified|fully compliant|officially approved|is approved|are approved)\b/i.test(rewrite)) return false;
  return true;
}

// Optional friendly rewrite of a short grounded answer. Discarded unless it adds nothing new.
async function rewriteNext(r, message, llm) {
  try {
    const reply = await llm({
      system: 'You are a friendly helper in a Washington small business checklist app. Reword the given answer in 2 to 4 short, warm sentences. Use ONLY the facts in it. Do not add facts, numbers, dates, fees or links. Keep "Pending verification" and step names exactly. Do not say a requirement is confirmed. US English, no em dashes, no markdown.',
      user: `Question: ${message}\n\nAnswer to reword:\n${r.answer}`,
    });
    const needsPending = /Pending verification/.test(r.answer.split('\n').slice(0, 3).join(' '));
    if (acceptRewrite(reply, r.answer, r.links.map((l) => l.url)) && (!needsPending || /pending verification/i.test(reply)) && r.matched.every((m) => reply.includes(m.title))) {
      return { ...r, answer: reply.trim(), mode: 'llm' };
    }
  } catch { /* keep grounded */ }
  return r;
}

export async function answerQuestion({ message, conversation = [], rules, checklist = null, llm = null }) {
  if (GREETING.test(message.trim()) && message.trim().split(/\s+/).length <= 5) {
    return {
      answer: 'I answer questions about the steps in this checklist, using only the rules and guides in this app. Ask about a license, a filing, fees, timing, or what comes next on your checklist.',
      links: [], matched: [], mode: 'grounded',
      suggestions: ['Do I need a business license?', 'How long does the DOR license take?', 'What is workers\' compensation?', 'What is my next step?'],
    };
  }
  if (THANKS.test(message.trim())) return { answer: 'You are welcome. Ask me about any step, its fees or timing, or say "what is my next step?" anytime.', links: [], matched: [], mode: 'grounded', suggestions: ['What is my next step?', 'How do I get started?'] };
  if (BYE.test(message.trim())) return { answer: 'Good luck with your business. Confirm each requirement with the agency before you apply. I am here if you have more questions.', links: [], matched: [], mode: 'grounded' };
  if (OUT_OF_SCOPE.test(message)) return outOfScope();
  if (CAPS.test(message)) return capabilitiesAnswer();
  if (SUBMIT_FOR_ME.test(message)) return limitAnswer('submit', rules, checklist, message);
  if (GUARANTEE.test(message)) return limitAnswer('guarantee', rules, checklist, message);
  const lastA = lastAssistantText(conversation);
  const clarifying = /Pick one and I will guide you/.test(lastA);
  if (clarifying && (WHICH.test(message) || REPEAT.test(message))) { const w = whichAnswer(lastA, rules); if (w) return w; }
  if (clarifying && (GUIDE_NEXT.test(message.trim()) || CHAIN.test(message.trim()) || (message.trim().split(/\s+/).length <= 9 && /\bafter that\b|\bwhat (comes|happens) (next|then|after)\b|\bthen what\b/i.test(message)))) {
    const opts = [...lastA.matchAll(/"(.+?)"/g)].map((m) => byTitle(rules, m[1])).filter(Boolean).slice(0, 3);
    if (opts.length >= 2) return { ...clarifyForm(opts, rules), answer: `Which one first? ${opts.map((r) => `"${r.title}"`).join(' or ')}. Pick one and I will guide you one step at a time.` };
  }
  if (GUIDE_NEXT.test(message.trim())) { const adv = guideAdvance(conversation, rules); if (adv) return adv; }
  if (GUIDE_ASK.test(message) && !FULL_LIST.test(message)) {
    const g = guideAnswer({ message, conversation, rules, checklist });
    if (g) return g;
  }
  if (conversation.length && REPEAT.test(message)) {
    const sm = /Step (\d+) of (\d+) \((.+?)\): /.exec(lastA);
    const rr = sm && byTitle(rules, sm[3]);
    if (rr) { const g = guideStep(rr, Number(sm[1])); return { ...g, answer: `Here is that step again.\n${g.answer}` }; }
    const f = focusFrom(lastA, rules);
    if (f) { const d = describeRule(f, 'how do I do this? steps'); return { answer: `Here is "${f.title}" again, in more detail.\n${d.text}`, links: linksFor(f, d.usedFacts), matched: [{ id: f.id, title: f.title }], mode: 'grounded', suggestions: ['Guide me through it', 'What is my next step?'] }; }
  }
  if (COMPLETED_N.test(message)) {
    const n = NUM[(COMPLETED_N.exec(message)[4] || '').toLowerCase()];
    if (n && checklist?.saved) {
      const hypo = { ...checklist, items: checklist.items.map((it, i) => (i < n ? { ...it, done: true } : it)) };
      const r = nextStepsAnswer({ rules, checklist: hypo, message: '', conversation: [] });
      const names = checklist.items.slice(0, n).map((i) => i.title).join('; ');
      return { ...r, answer: `If you have completed the first ${n} step${n === 1 ? '' : 's'} (${names}):\n${r.answer}` };
    }
    if (n) {
      const anchor = orderedRules(rules)[n - 1];
      const r = anchor && ruleOrderAnswer({ rules, message, anchorRule: anchor });
      if (r) return r;
    }
  }
  if (DONE_Q.test(message) && !COMPLETED_N.test(message)) return checklist?.saved ? progressAnswer('done', checklist) : { ...checklistAnswer(checklist) };
  if (INCOMPLETE_Q.test(message)) return checklist?.saved ? progressAnswer('todo', checklist) : { ...checklistAnswer(checklist) };
  if (APPROVED_Q.test(message)) return pendingAnswer(rules, checklist, true);
  if (PENDING_Q.test(message) && /\b(link|url|website|web ?site|page)\b/i.test(message)) {
    const all = pendingRules(rules, checklist);
    const local = all.filter((x) => x.id === 'health' || x.id === 'local');
    const list = /\b(county|city|local)\b/i.test(message) && local.length ? local : all;
    const wiz = rules.find((r) => r.id === 'wizard');
    return {
      answer: `I don't have a verified official link for a pending county or local requirement, and I won't guess one. Pending verification means the source was not reviewed.${list.length ? `\nPending steps: ${list.map((x) => x.title).join('; ')}.` : ''}\nTo find the right county or city office, the state's Business Licensing Wizard lists agencies to contact for your business. Confirm with your county health department.`,
      links: wiz && isHttps(wiz.apply?.url) ? [{ label: wiz.apply.label || wiz.title, url: wiz.apply.url }] : [], matched: list.slice(0, 3), mode: 'grounded', suggestions: ['What is still pending?', 'What is my next step?'],
    };
  }
  if (PENDING_Q.test(message) && !/\b(link|fee|cost|url|website|source)\b/i.test(message) && !(scoreRules(rules, message.replace(PENDING_Q, ' '))[0]?.score >= 5)) return pendingAnswer(rules, checklist, false);
  if (HIRE.test(message) && !HIRE_NOT.test(message) && !/\bafter\b/i.test(message)) return hireAnswer(rules, checklist);
  const chainLikeMsg = isChainLike(message);
  const afterQ = AFTER.test(message) && NEXT_Q.test(message);
  const chain = (CHAIN.test(message.trim()) || (message.trim().split(/\s+/).length <= 9 && /\bafter that\b|\bwhat (comes|happens) (next|then|after)\b|\bthen what\b/i.test(message))) && (checklist?.saved || conversation.some((t) => t?.role === 'assistant' && /(Next step|Next in order): /.test(t.content || '')));
  if (FULL_LIST.test(message) && (checklist?.saved || /\bmy\b|checklist/i.test(message))) return checklistAnswer(checklist);
  if (FIRST_Q.test(message) && !chainLikeMsg) {
    if (checklist?.saved) return nextStepsAnswer({ rules, checklist });
    const first = orderedRules(rules)[0];
    const lines = ["In this app's usual order, the first step is:", `Next in order: ${first.title}. (${first.agency})`];
    const why = firstSentence(first.guide?.meaning);
    if (why) lines.push(why);
    lines.push('This is the general order. Choose a sample business or complete the questionnaire to see which steps apply to your business.');
    return { answer: lines.join('\n'), links: linksFor(first).slice(0, 1), matched: [{ id: first.id, title: first.title }], mode: 'grounded', suggestions: ['What comes after that?', 'Guide me through it'] };
  }
  if ((afterQ || chain || MINE.test(message)) && checklist?.saved) {
    const r = nextStepsAnswer({ rules, checklist, anchorRule: resolveAnchor({ message, rules, conversation }) });
    return llm ? rewriteNext(r, message, llm) : r;
  }
  if (!checklist?.saved && (afterQ || chainLikeMsg || (NEXT_THE.test(message) && !/\bmy\b/i.test(message)))) {
    const anchorRule = resolveAnchor({ message, rules, conversation });
    if (anchorRule) { const r = ruleOrderAnswer({ rules, message, anchorRule }); if (r) return r; }
  }
  if (MINE.test(message)) return checklistAnswer(checklist);
  if (HELP_ME.test(message) && !(scoreRules(rules, message)[0]?.score >= 5)) return startAnswer(rules, checklist);
  if (START.test(message) || OVERVIEW.test(message)) {
    const top = scoreRules(rules, message)[0];
    // A broad question gets the overview unless it clearly names one step.
    if (!top || top.score < 5 || START.test(message) || OVERVIEW.test(message)) return startAnswer(rules, checklist);
  }

  let ranked = scoreRules(rules, message);
  const vague = VAGUE_HOW.test(message.trim());
  if (vague && !(ranked[0]?.score >= 3)) {
    const topic = currentTopic(rules, conversation, checklist);
    if (!topic) return startAnswer(rules, checklist);
    ranked = [{ rule: topic, score: 10 }];
  }
  // A real follow-up ("how long does it take?", "and the fee?") borrows the previous user question.
  // A new off-topic question must not inherit the old topic, so only fee/time/steps/who/link questions qualify.
  const looksLikeFollowUp = wants.money.test(message) || wants.time.test(message) || wants.link.test(message) || /^(and|also|what about|how about)\b/i.test(message.trim());
  if ((!ranked.length || ranked[0].score < 3) && conversation.length && looksLikeFollowUp) {
    const prev = [...conversation].reverse().find((t) => t.role === 'user');
    if (prev) {
      const second = scoreRules(rules, `${prev.content} ${message}`);
      if (second.length && (!ranked.length || second[0].score > ranked[0].score)) ranked = second;
    }
  }
  if (!ranked.length || ranked[0].score < 3) return fallback(rules);

  const top = ranked[0].rule;
  if (NEED_Q.test(message) && checklist?.saved) {
    const mine = checklist.items.find((i) => i.id === top.id);
    const lines = [];
    if (DEFINITE.test(message)) {
      lines.push(pending(top) ? 'I can\'t confirm that it is definitely required. This requirement is Pending verification, so I do not have a verified answer.' : 'I can\'t guarantee that. This reflects an agency page that was checked, and it is not yet Approved by a named reviewer.');
      if (pending(top)) lines.push('This demo has no verified rule for a specific city or county.');
    }
    if (mine) {
      if (pending(top)) lines.push(`"${top.title}" is on your checklist, but it is Pending verification, so I can't confirm it is required.`);
      else lines.push(`${DEFINITE.test(message) ? 'It is' : 'Yes,'} "${top.title}" is on your checklist (${stepLabel(mine)}).`);
      const g = firstSentence(top.guide?.meaning);
      if (g) lines.push(g);
      lines.push(pending(top) ? `Pending verification: ${top.guide?.pendingNote || 'this requirement is not confirmed in this demo.'} Confirm it with the relevant agency.` : statusLine(top));
    } else {
      lines.push(`No. "${top.title}" is not on your checklist, based on your answers.`);
      if (top.reason?.no && !/[{}]/.test(top.reason.no)) lines.push(top.reason.no);
      lines.push('If your plans change, edit your answers to update your checklist.');
    }
    return { answer: lines.join('\n'), links: mine && !pending(top) ? linksFor(top).slice(0, 2) : [], matched: [{ id: top.id, title: top.title }], mode: 'grounded', suggestions: mine ? ['Guide me through it', 'What is my next step?'] : ['Show my full checklist'] };
  }
  const { text, usedFacts } = describeRule(top, vague ? 'how do I do this? steps' : message);
  let answer = text;
  let links = linksFor(top, usedFacts);
  if (wants.link.test(message) && pending(top)) {
    links = [];
    answer += '\nI don\'t have a verified official link for this step, and I won\'t guess one.';
  }
  if (DEFINITE.test(message)) {
    answer = `${pending(top) ? 'I can\'t confirm that it is definitely required. This requirement is Pending verification.' : 'I can\'t guarantee that. This reflects an agency page that was checked, and it is not yet Approved by a named reviewer.'}\n${answer}`;
  }
  if (pending(top) && links.length) answer += '\nThe link below is the state page this statement came from. It does not confirm a county or local requirement.';
  const matched = [{ id: top.id, title: top.title }];
  const alsoClose = ranked.slice(1, 3).filter((x) => x.score >= Math.max(3, ranked[0].score * 0.7));
  if (alsoClose.length) answer += `\nRelated steps: ${alsoClose.map((x) => x.rule.title).join('; ')}.`;
  for (const x of alsoClose) matched.push({ id: x.rule.id, title: x.rule.title });
  let checklistLine = '';
  if (checklist?.saved) {
    const mine = checklist.items.find((i) => i.id === top.id);
    checklistLine = mine ? `On your checklist: ${mine.verification?.status === 'pending' ? 'Pending verification' : mine.status === 'applies' ? 'Applies to you' : 'May apply, confirm'}.` : 'This step is not on your checklist based on your answers.';
    answer += mine ? `\nOn your checklist: ${mine.verification?.status === 'pending' ? 'Pending verification' : mine.status === 'applies' ? 'Applies to you' : 'May apply, confirm'}.` : '\nThis step is not on your checklist based on your answers.';
  }
  if (wants.link.test(message) && !links.length) answer += '\nThere is no verified link for this step in the current rules.';

  let mode = 'grounded';
  if (llm) {
    // RAG: give the model only the retrieved records and the recent turns. It may only rephrase them.
    const used = [top, ...alsoClose.map((x) => x.rule)];
    const context = used.map((r, i) => `[${i + 1}] ${r.title} (${r.agency}). ${ruleText(r)} Status: ${statusLine(r)}`).join('\n\n');
    const history = conversation.filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string').slice(-6).map((t) => ({ role: t.role, content: t.content.slice(0, 600) }));
    try {
      const reply = await llm({
        system: 'You are a friendly, plain-spoken helper inside a Washington small business checklist app. Answer ONLY from the CONTEXT records. If the context does not answer the question, say you do not have that in the current rules. Never add facts, numbers, dates, fees or links. Do not paste links; they are shown separately. Do not say a requirement applies to the person; point them to their checklist. Keep status phrases such as "Pending verification" and "Not yet Approved" exactly. Be warm, short and clear: 2 to 5 short sentences, US English, no em dashes, no markdown. Use earlier turns only to understand follow-ups.',
        user: `CONTEXT:\n${context}\n\nQUESTION: ${message}${vague ? ' (This asks how to do the step in the context. Explain its steps.)' : ''}`,
        history,
      });
      if (acceptRewrite(reply, `${context}\n${answer}`, links.map((l) => l.url))) { 
        const r = reply.trim();
        const hasStatus = pending(top) ? /pending verification/i.test(r) : /not yet approved/i.test(r);
        answer = `${r}${hasStatus ? '' : `\n${statusLine(top)}`}${checklistLine ? `\n${checklistLine}` : ''}`;
        mode = 'llm';
      }
    } catch {
      /* keep the grounded answer */
    }
  }
  return { answer, links, matched, mode };
}

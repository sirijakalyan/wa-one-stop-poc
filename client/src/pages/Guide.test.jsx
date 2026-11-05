import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AppProvider } from '../AppContext.jsx';
import { isEcho, isLineEcho, QUIET_AFTER_SPEECH_MS } from './Guide.jsx';
import { installMockServer } from '../artifact/mockServer.js';

// Through the real screens, the in-page API and the real rules engine.
beforeEach(() => {
  window.scrollTo = () => {};
  installMockServer();
});

const STORY = 'I want to open a food truck in Spokane and hire two people.';
function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProvider>
        <App />
      </AppProvider>
    </MemoryRouter>
  );
}
const tap = async (user, name) => user.click(await screen.findByRole('button', { name }));
// Captions repeat the latest line, so conversation text is read from the log only.
const planPanel = () => within(screen.getByRole('region', { name: /^Your plan/ }));
const log = () => within(screen.getByRole('log', { name: 'Conversation with the guide' }));
const inLog = async (re) => within(await screen.findByRole('log', { name: 'Conversation with the guide' })).findByText(re);

describe('home page', () => {
  it('greets with the guide, offers three equal ways in and a one-sentence start', async () => {
    renderAt('/');
    expect(screen.getByTestId('greeting')).toHaveTextContent("Hi, I'm here to help you start your Washington business");
    expect(screen.getByRole('img', { name: /friendly person and a small robot/i })).toBeInTheDocument();
    expect(screen.getAllByText(/You're talking to an AI guide/).length).toBeGreaterThan(0);
    const ways = within(screen.getByRole('list', { name: 'Choose how to start' }));
    expect(ways.getByRole('button', { name: 'Talk to me' })).toBeInTheDocument();
    expect(ways.getByRole('button', { name: 'Type instead' })).toBeInTheDocument();
    expect(ways.getByRole('button', { name: 'Use the step-by-step form' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tell the guide about your business, or answer its question')).toBeInTheDocument();
    expect(screen.getByText(/do not ask for names, addresses or tax numbers/i)).toBeInTheDocument();
    // The three sample businesses are quick-start chips.
    for (const name of ['Home-based service business', 'Restaurant', 'Construction contractor']) {
      expect(await screen.findByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('keeps what the owner types out of the address bar', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: 'Use the step-by-step form' }));
    await user.type(screen.getByLabelText('Describe your business in one sentence'), STORY);
    expect(screen.getByRole('button', { name: 'Start with this sentence' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Start with this sentence' }));
    // The sentence was sent to the guide as the first message.
    expect(await screen.findByRole('heading', { name: 'Your guide' })).toBeInTheDocument();
    expect(await inLog(/^I heard:/)).toBeInTheDocument();
  });
});

describe('guide screen', () => {
  async function openStory(user) {
    renderAt({ pathname: '/guide', state: { mode: 'type', start: STORY } });
    await inLog(/^I heard:/);
  }

  it('reads the story back, adds nothing to the plan until confirmed, then builds the plan with the trigger on every step', async () => {
    const user = userEvent.setup();
    await openStory(user);
    expect(log().getByText(STORY)).toBeInTheDocument();
    expect(log().getByText(/I heard: .*Spokane, Spokane County.*hiring 2 people within 90 days/)).toBeInTheDocument();
    // Card rows are "heard", not confirmed. The plan is still empty.
    expect(screen.getAllByText('Heard, please confirm').length).toBe(3);
    expect(screen.getByText(/Steps appear here as you confirm facts/)).toBeInTheDocument();
    expect(screen.getByText(/The road fills in as steps join your plan/)).toBeInTheDocument();

    await tap(user, "Yes, that's right");
    await waitFor(() => expect(planPanel().getByText('Check for a county health department permit')).toBeInTheDocument());
    expect(screen.getAllByText('Confirmed').length).toBe(3);
    const because = screen.getAllByText('Because:');
    expect(because.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText(/You chose food service/)).toBeInTheDocument();
    // The guide now asks only for what it has not heard.
    expect(await inLog(/How will your business be set up/)).toBeInTheDocument();
    expect(screen.queryByText('Register as a contractor with Labor & Industries')).not.toBeInTheDocument();
  });

  it('runs the food truck story to a complete card, a road to opening day with only published times, and an estimate', async () => {
    const user = userEvent.setup();
    await openStory(user);
    await tap(user, "Yes, that's right");
    // structure, subcontractors, sales tax, income, business name
    for (const [question, name] of [[/set up/, 'Not sure'], [/subcontractors/, 'No'], [/sales tax/, 'Yes'], [/\$12,000/, 'Yes'], [/name other than/, 'Yes']]) {
      await inLog(question);
      await tap(user, name);
    }
    expect(await inLog(/That is everything I need/)).toBeInTheDocument();
    expect(screen.getByText('8 of 8 confirmed')).toBeInTheDocument();
    const est = await screen.findByTestId('estimate');
    expect(est).toHaveTextContent(/Earliest estimate: [A-Z][a-z]+ \d{1,2}, \d{4}/);
    expect(est).toHaveTextContent(/not a guarantee/);
    // Times appear only where an agency published one.
    expect(screen.getByText(/Online application: approximately 10 business days/)).toBeInTheDocument();
    expect(screen.getAllByText('Time not published').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/Left out of your plan/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Save my plan and open my checklist' })[0]).toBeEnabled();
    // Pending items stay labeled pending.
    expect(screen.getAllByText('Pending verification').length).toBeGreaterThan(0);
  });

  it('simulates a rule change publicly, labels it a simulation, and can end it', async () => {
    const user = userEvent.setup();
    await openStory(user);
    await tap(user, "Yes, that's right");
    await user.click(await screen.findByRole('button', { name: 'Simulate a rule change' }));
    const region = await screen.findByRole('region', { name: /Rule change/ });
    expect(within(region).getByText('Simulation')).toBeInTheDocument();
    expect(region).toHaveTextContent('approximately 10 business days');
    expect(region).toHaveTextContent('approximately 15 business days');
    expect(region).toHaveTextContent(/Draft notice for a person to approve/);
    expect(region).toHaveTextContent(/made-up change/);
    expect(within(region).getByRole('link', { name: 'See it in Notifications' })).toHaveAttribute('href', '/notifications');
    await user.click(within(region).getByRole('button', { name: /End simulation/ }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /Rule change/ })).toBeNull());
  });

  it('lets the owner edit a row, which confirms it and changes the plan', async () => {
    const user = userEvent.setup();
    await openStory(user);
    await tap(user, "Yes, that's right");
    await waitFor(() => expect(planPanel().getByText('Report new hires to DSHS')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit Hiring within 90 days' }));
    await user.selectOptions(screen.getByLabelText('Hiring within 90 days'), 'no');
    await user.click(screen.getByRole('button', { name: 'Save and confirm' }));
    await waitFor(() => expect(planPanel().queryByText('Report new hires to DSHS')).toBeNull());
  });

  it('answers a question from the app\'s own rules, then goes back to the question it was on', async () => {
    const user = userEvent.setup();
    await openStory(user);
    await tap(user, "Yes, that's right");
    await inLog(/How will your business be set up/);
    await user.type(screen.getByLabelText(/Tell the guide about your business/), 'Do I need a business license?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(log().getAllByText(/license/i).length).toBeGreaterThan(0));
    // The card did not change because of a question.
    expect(screen.getAllByText('Confirmed').length).toBe(3);
    expect(log().getAllByText(/How will your business be set up/).length).toBeGreaterThan(1);
  });

  it('switching to the form keeps the confirmed answers', async () => {
    const user = userEvent.setup();
    await openStory(user);
    await tap(user, "Yes, that's right");
    await user.click(screen.getByRole('button', { name: 'Use the step-by-step form instead' }));
    expect(await screen.findByText('How will your business be set up?')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Not sure yet/)).toBeInTheDocument();
  });

  it('has a conversation log, always-on captions and a tab that shows how many steps the plan has', async () => {
    const user = userEvent.setup();
    await openStory(user);
    expect(screen.getByRole('log', { name: 'Conversation with the guide' })).toBeInTheDocument();
    expect(screen.getByTestId('captions')).toHaveTextContent(/Guide: .*I heard/);
    await tap(user, "Yes, that's right");
    await waitFor(() => expect(planPanel().getByText('Check for a county health department permit')).toBeInTheDocument());
    const tabPlan = screen.getByRole('tab', { name: /Plan/ });
    expect(within(tabPlan).getByLabelText(/\d+ steps/)).toBeInTheDocument();
    await user.click(tabPlan);
    expect(tabPlan).toHaveAttribute('aria-selected', 'true');
  });
});

// The browser's speech features are faked, so these tests check what the screen asks them to do.
describe('echo check', () => {
  it('treats a phrase from the guide as echo, but a short answer as the owner even if the word appears in the guide text', () => {
    const line = 'You can pick Sole proprietor, LLC, Corporation or Partnership. How will your business be set up?';
    expect(isEcho('How will your business be set up', line)).toBe(true);
    expect(isEcho('how will your business', line)).toBe(true);
    expect(isEcho('LLC', line)).toBe(false);
    expect(isEcho('sole proprietor', line)).toBe(false);
    expect(isEcho('I want an LLC please', line)).toBe(false);
  });
});

describe('line echo', () => {
  const line = 'Do you plan to hire employees in Washington?';
  it('catches one or two words of the guide\'s line coming back, never yes or no', () => {
    expect(isLineEcho('business', 'How will your business be set up? Tap one below, or tell me.')).toBe(true);
    expect(isLineEcho('Washington', line)).toBe(true);
    expect(isLineEcho('hire employees', line)).toBe(true);
    expect(isLineEcho('yes', line)).toBe(false);
    expect(isLineEcho('no', line)).toBe(false);
    expect(isLineEcho('LLC', line)).toBe(false);
    expect(isLineEcho('I have two employees', line)).toBe(false);
  });
});

describe('voice', () => {
  let spoken;
  class FakeRec {
    constructor() { FakeRec.last = this; }
    start() { this.started = true; }
    abort() { this.started = false; this.onend?.(); }
    say(text) { this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] }); this.started = false; this.onend(); }
  }
  beforeEach(() => {
    window.sessionStorage.clear();
    spoken = [];
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    window.speechSynthesis = {
      speak: vi.fn((u) => { spoken.push(u.text); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 0); }),
      cancel: vi.fn(),
      getVoices: () => [],
    };
    window.webkitSpeechRecognition = FakeRec;
    FakeRec.last = null;
  });
  afterEach(() => {
    delete window.SpeechSynthesisUtterance;
    delete window.speechSynthesis;
    delete window.webkitSpeechRecognition;
  });

  it('is silent until the owner taps: typing mode never speaks and says voice is off', async () => {
    renderAt({ pathname: '/guide', state: { mode: 'type' } });
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent(/Voice is off/);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('"Talk to me" has the guide speak its greeting aloud, with captions and Stop and Mute visible', async () => {
    const user = userEvent.setup();
    renderAt('/');
    // Talk is the default way in: the greeting is spoken without a tap.
    expect(screen.getByRole('button', { name: 'Talk to me' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(spoken[0]).toMatch(/^Hi, I'm here to help you start your Washington business/));
    expect(screen.getByTestId('captions')).toHaveTextContent(/Hi, I'm here to help/);
    expect(screen.getByRole('button', { name: 'Mute voice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Microphone (on|off)/ })).toBeEnabled();
  });

  it('opening the home page starts the microphone by itself once the greeting is done', async () => {
    renderAt('/');
    await waitFor(() => expect(spoken.length).toBeGreaterThan(0));
    await waitFor(() => expect(FakeRec.last?.started).toBe(true), { timeout: 4000 });
    expect(screen.getByRole('button', { name: /Microphone on/ })).toBeInTheDocument();
  });

  it('the microphone is off while the guide speaks, so it cannot hear itself, and Skip goes straight to listening', async () => {
    const user = userEvent.setup();
    // A guide line that keeps playing until it is cancelled.
    window.speechSynthesis.speak = vi.fn((u) => { spoken.push(u.text); setTimeout(() => u.onstart?.(), 0); });
    renderAt('/');
    await waitFor(() => expect(screen.getAllByText(/Your microphone is paused/).length).toBeGreaterThan(0));
    expect(FakeRec.last?.started).toBeFalsy();
    await tap(user, 'Skip');
    await waitFor(() => expect(FakeRec.last?.started).toBe(true), { timeout: 4000 });
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });

  it('the microphone waits a moment after the guide finishes before it listens', async () => {
    renderAt('/');
    await waitFor(() => expect(spoken.length).toBeGreaterThan(0));
    const endedAt = Date.now();
    await waitFor(() => expect(FakeRec.last?.started).toBe(true), { timeout: 4000 });
    expect(Date.now() - endedAt).toBeGreaterThanOrEqual(QUIET_AFTER_SPEECH_MS - 100);
  });

  it('the greeting is read in pieces that get louder', async () => {
    const volumes = [];
    window.speechSynthesis.speak = vi.fn((u) => { spoken.push(u.text); volumes.push(u.volume); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 0); });
    renderAt('/');
    await waitFor(() => expect(volumes.length).toBeGreaterThan(2));
    expect(volumes[0]).toBeLessThan(0.3);
    expect(volumes[volumes.length - 1]).toBe(1);
    expect([...volumes].sort((x, y) => x - y)).toEqual(volumes);
  });

  it('reads each new guide reply aloud, but never the owner\'s own words', async () => {
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'talk', start: STORY } });
    await waitFor(() => expect(spoken.some((t) => /^I heard:/.test(t))).toBe(true));
    expect(spoken.some((t) => t === STORY)).toBe(false);
    const before = spoken.length;
    await tap(user, "Yes, that's right");
    await waitFor(() => expect(spoken.length).toBeGreaterThan(before));
    expect(spoken[spoken.length - 1]).toMatch(/How will your business be set up/);
  });

  it('Mute voice stops speech now and keeps later replies quiet', async () => {
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'talk', start: STORY } });
    await waitFor(() => expect(spoken.some((t) => /^I heard:/.test(t))).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Mute voice' }));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Unmute voice' })).toBeInTheDocument();
    const before = spoken.length;
    await tap(user, "Yes, that's right");
    await inLog(/How will your business be set up/);
    expect(spoken.length).toBe(before);
  });

  it('Mute voice also switches the microphone off, and Unmute brings it back', async () => {
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'type' } });
    await user.click(await screen.findByRole('button', { name: /Microphone off/ }));
    await waitFor(() => expect(FakeRec.last?.started).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Mute voice' }));
    await waitFor(() => expect(FakeRec.last.started).toBe(false));
    expect(screen.getByRole('button', { name: /Microphone off/ })).toBeInTheDocument();
    expect(screen.getByText(/Muted\. The guide is quiet and your microphone is off/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unmute voice' }));
    await waitFor(() => expect(FakeRec.last.started).toBe(true));
  });

  it('a mute is remembered when the owner leaves the page and comes back: no voice, no microphone, until Unmute', async () => {
    const user = userEvent.setup();
    const first = renderAt({ pathname: '/guide', state: { mode: 'type' } });
    await user.click(await screen.findByRole('button', { name: /Microphone off/ }));
    await waitFor(() => expect(FakeRec.last?.started).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Mute voice' }));
    await waitFor(() => expect(FakeRec.last.started).toBe(false));
    first.unmount();
    FakeRec.last = null;
    spoken.length = 0;
    renderAt({ pathname: '/guide', state: { mode: 'talk' } });
    expect(await screen.findByRole('button', { name: 'Unmute voice' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 400));
    expect(spoken.length).toBe(0);
    expect(FakeRec.last?.started || false).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Unmute voice' }));
    await waitFor(() => expect(FakeRec.last?.started).toBe(true)); // Unmute brings the microphone back in Talk mode, even after leaving the page
  });

  it('the microphone stays on when the tab is hidden and shown again, and only Mute turns it off', async () => {
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'type' } });
    await user.click(await screen.findByRole('button', { name: /Microphone off/ }));
    await waitFor(() => expect(FakeRec.last?.started).toBe(true));
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(FakeRec.last.started).toBe(true);
    expect(screen.queryByText(/paused because you left this tab/)).toBeNull();
  });

  it('the microphone turns spoken words into a message the guide answers, and Stop turns it off', async () => {
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'type' } });
    await user.click(await screen.findByRole('button', { name: /Microphone off/ }));
    await waitFor(() => expect(FakeRec.last?.started).toBe(true));
    expect(screen.getByRole('button', { name: /Microphone on/ })).toHaveAttribute('aria-pressed', 'true');
    FakeRec.last.say('I want to open a food truck in Spokane and hire two people');
    expect(await inLog(/^I heard:/)).toBeInTheDocument();
    expect(log().getByText('I want to open a food truck in Spokane and hire two people')).toBeInTheDocument();
    await waitFor(() => expect(spoken.some((t) => /^I heard:/.test(t))).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByRole('button', { name: /Microphone off/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"yes that is right" said aloud confirms the read-back, and "save my plan" said aloud saves and opens the checklist', async () => {
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'type', start: STORY } });
    await inLog(/^I heard:/);
    const input = await screen.findByLabelText(/Tell the guide about your business/);
    await user.type(input, 'yes that is right{Enter}');
    expect(await inLog(/How will your business be set up/)).toBeInTheDocument();
    for (const [question, name] of [[/set up/, 'Not sure'], [/subcontractors/, 'No'], [/sales tax/, 'Yes'], [/\$12,000/, 'Yes'], [/name other than/, 'Yes']]) {
      await inLog(question);
      await tap(user, name);
    }
    expect(await inLog(/Say or tap Save my plan and open my checklist/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Tell the guide about your business/), 'save my plan{Enter}');
    expect(await screen.findByRole('heading', { name: /checklist/i })).toBeInTheDocument();
  });

  it('a lone spoken "yes" or "no" is taken at every step, including the fifth', async () => {
    renderAt({ pathname: '/guide', state: { mode: 'talk', start: STORY } });
    const say = async (text) => {
      await waitFor(() => expect(FakeRec.last?.started).toBe(true), { timeout: 5000 });
      FakeRec.last.say(text);
    };
    await inLog(/^I heard:/);
    await say('yes');
    await inLog(/How will your business be set up/);
    await say('not sure');
    await inLog(/subcontractors/);
    await say('no');
    await inLog(/sales tax/);
    await say('yes');
    await inLog(/\$12,000/);
    await say('yes');
    await inLog(/name other than/);
    await say('yes');
    expect(await inLog(/Say or tap Save my plan and open my checklist/)).toBeInTheDocument();
  });

  it('says so, and keeps typing working, when the browser cannot listen', async () => {
    delete window.webkitSpeechRecognition;
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'type' } });
    await user.click(await screen.findByRole('button', { name: /Microphone off/ }));
    expect(await screen.findByText(/This browser cannot listen/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tell the guide about your business/)).toBeEnabled();
  });
});

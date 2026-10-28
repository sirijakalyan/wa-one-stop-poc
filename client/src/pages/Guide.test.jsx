import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AppProvider } from '../AppContext.jsx';
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
    expect(ways.getByRole('link', { name: 'Use the step-by-step form' })).toHaveAttribute('href', '/questionnaire');
    expect(screen.getByRole('button', { name: 'Start with this sentence' })).toBeDisabled();
    expect(screen.getByText(/do not ask for names, addresses or tax numbers/i)).toBeInTheDocument();
    // The three sample businesses are quick-start chips.
    for (const name of ['Home-based service business', 'Restaurant', 'Construction contractor']) {
      expect(await screen.findByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('keeps what the owner types out of the address bar', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.type(screen.getByLabelText('Describe your business in one sentence'), STORY);
    await user.click(screen.getByRole('button', { name: 'Start with this sentence' }));
    // The sentence was sent to the guide as the first message.
    expect(await screen.findByRole('heading', { name: 'Your guide' })).toBeInTheDocument();
    expect(await inLog(/^I heard:/)).toBeInTheDocument();
  });

  it('"Talk to me" opens the guide and is honest that voice is not switched on yet', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: 'Talk to me' }));
    expect(await screen.findByText(/Voice is not switched on in this build/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tell the guide about your business/)).toBeEnabled();
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
    expect(screen.getByRole('button', { name: 'Save my plan and open my checklist' })).toBeEnabled();
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

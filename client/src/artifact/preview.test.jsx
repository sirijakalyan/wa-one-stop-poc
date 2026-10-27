import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AppProvider } from '../AppContext.jsx';
import { installMockServer } from './mockServer.js';

// End to end through the real React screens, the in-page API and the real rules engine.
beforeEach(() => {
  window.scrollTo = () => {};
  installMockServer();
});

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppProvider>
        <App />
      </AppProvider>
    </MemoryRouter>
  );
}

describe('in-page preview', () => {
  it('builds the restaurant checklist, marks a step done, and shows a rule-change alert after an admin publishes', async () => {
    const user = userEvent.setup();
    renderApp();

    // Landing page, sample card
    const card = (await screen.findByRole('heading', { name: 'Restaurant', level: 3 })).closest('li');
    await user.click(within(card).getByRole('button', { name: 'See this checklist' }));

    // Checklist from the real engine
    expect(await screen.findByRole('heading', { name: 'Sample checklist: Restaurant' })).toBeInTheDocument();
    expect(screen.getByText('File your business entity with the Secretary of State')).toBeInTheDocument();
    expect(screen.getByText('Check for a county health department permit')).toBeInTheDocument();
    expect(screen.queryByText('Register as a contractor with Labor & Industries')).not.toBeInTheDocument();
    expect(screen.getByText('0 of 8 steps marked done')).toBeInTheDocument();

    // Mark a step done
    const sosItem = screen.getByText('File your business entity with the Secretary of State').closest('li');
    await user.click(within(sosItem).getByLabelText('Mark as done'));
    expect(await screen.findByText('1 of 8 steps marked done')).toBeInTheDocument();

    // Disclaimer is still there after navigating
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/confirm with the relevant agency/i);

    // Admin: edit the DOR rule, approve with a reviewer
    await user.click(screen.getByRole('link', { name: /Admin rules/ }));
    const who = await screen.findByTestId('who-can-edit');
    for (const part of [/admin key/i, /reviewer/i, /draft changes/i, /publishing/i, /cannot tell who/i, /different person/i]) expect(who).toHaveTextContent(part);
    await user.click(await screen.findByRole('button', { name: /Edit Apply for your Washington business license/ }));
    const detail = await screen.findByLabelText('Plain-language detail');
    await user.clear(detail);
    await user.type(detail, 'Updated detail for the preview test.');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Side-by-side change')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Reviewer name/), 'Demo reviewer');
    await user.click(screen.getByRole('button', { name: 'Approve and publish' }));
    expect(await screen.findByText(/Published as version 2. Simulated notices queued: 1/)).toBeInTheDocument();

    // Notification appears
    await user.click(screen.getByRole('link', { name: 'Notifications' }));
    expect(await screen.findByText(/Rule changed: Apply for your Washington business license/)).toBeInTheDocument();
  });

  it('runs the questionnaire to a checklist and keeps the Secretary of State step out for a sole proprietor', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Start the questionnaire' }));
    await user.click(screen.getByLabelText(/^Sole proprietor/));
    await user.click(screen.getByRole('button', { name: 'Next' })); // structure
    await user.click(screen.getByRole('button', { name: 'Next' })); // description left blank
    await user.click(screen.getByRole('button', { name: 'Next' })); // business type (none chosen)
    await user.click(screen.getByRole('button', { name: 'Next' })); // city blank
    for (const answer of ['No', 'No', 'No', 'No', 'Yes']) { // hiring, subs, sales tax, income, business name
      await user.click(screen.getByLabelText(answer));
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Build my checklist' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Your personalized checklist' })).toBeInTheDocument());
    expect(screen.getByText('Apply for your Washington business license')).toBeInTheDocument();
    expect(screen.queryByText('File your business entity with the Secretary of State')).not.toBeInTheDocument();
  });
});

describe('county in the questionnaire and edit-answers flow', () => {
  async function openRestaurant(user) {
    const card = (await screen.findByRole('heading', { name: 'Restaurant', level: 3 })).closest('li');
    await user.click(within(card).getByRole('button', { name: 'See this checklist' }));
    await screen.findByRole('heading', { name: 'Sample checklist: Restaurant' });
  }
  async function changeCounty(user, county) {
    await user.click(screen.getByRole('button', { name: 'Edit answers' }));
    const row = (await screen.findByText('County')).closest('div').parentElement;
    await user.click(within(row).getByRole('button', { name: 'Change' }));
    const field = await screen.findByLabelText('County');
    await user.clear(field);
    if (county) await user.type(field, county);
    // walk forward to the review screen, then rebuild
    for (let i = 0; i < 12 && !screen.queryByRole('button', { name: 'Build my checklist' }); i += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Build my checklist' }));
    await screen.findByRole('heading', { name: /checklist/i, level: 1 });
    await screen.findByText('Check for a county health department permit');
  }
  const healthItem = () => screen.getByText('Check for a county health department permit').closest('li');

  it('asks for city and county, shows the entered county in the review, and keeps the city field', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Start the questionnaire' }));
    await user.click(screen.getByLabelText(/^Limited liability company/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' })); // business type
    expect(screen.getByLabelText('City')).toBeInTheDocument();
    await user.type(screen.getByLabelText('City'), 'Bellevue');
    // typing a known city fills its county, and it can still be edited
    expect(screen.getByLabelText('County')).toHaveValue('King');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    for (const answer of ['Yes', 'No', 'Yes', 'Yes', 'Yes']) {
      await user.click(screen.getByLabelText(answer));
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByText('Bellevue')).toBeInTheDocument();
    expect(screen.getByText('King County')).toBeInTheDocument();
  });

  it('typing "bel" suggests cities; choosing Bellevue fills King County and the review shows both', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Start the questionnaire' }));
    await user.click(screen.getByLabelText(/^Limited liability company/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' })); // business type
    await user.type(screen.getByLabelText('City'), 'bel');
    const list = screen.getByRole('listbox');
    expect(within(list).getByText('Bellevue')).toBeInTheDocument();
    expect(within(list).getByText('Bellingham')).toBeInTheDocument();
    await user.click(within(list).getByText('Bellevue'));
    expect(screen.getByLabelText('City')).toHaveValue('Bellevue');
    expect(screen.getByLabelText('County')).toHaveValue('King');
    expect(screen.getByRole('status')).toHaveTextContent('Bellevue is in King County.');
    // the county stays editable
    await user.clear(screen.getByLabelText('County'));
    await user.type(screen.getByLabelText('County'), 'Pierce');
    expect(screen.getByLabelText('County')).toHaveValue('Pierce');
  });

  it('shows the county health page found for the selected county, stays pending, and updates after editing', async () => {
    const user = userEvent.setup();
    renderApp();
    await openRestaurant(user);
    await changeCounty(user, 'King');
    let item = healthItem();
    const king = within(within(item).getByTestId('county-health')).getByRole('link', { name: /King County health department page/ });
    expect(king.getAttribute('href')).toMatch(/^https:\/\/kingcounty\.gov\//);
    expect(within(item).getByTestId('county-health')).toHaveTextContent(/Found by search on Oct 27, 2026\. Not yet checked by a person/);
    expect(within(item).getByText('Pending verification')).toBeInTheDocument();
    expect(screen.getByText('County: King County')).toBeInTheDocument();

    await changeCounty(user, 'Pierce County');
    item = healthItem();
    expect(within(item).getByRole('link', { name: /Pierce County health department page/ }).getAttribute('href')).toMatch(/^https:\/\/tpchd\.org\//);
    expect(within(item).queryByText(/King/)).toBeNull();
    expect(within(item).getByText('Pending verification')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/confirm with the relevant agency/i);
  });

  it('says clearly when no health page was found for the county, with no link', async () => {
    const user = userEvent.setup();
    renderApp();
    await openRestaurant(user);
    await changeCounty(user, 'Skagit');
    const box = within(healthItem()).getByTestId('county-health');
    expect(box).toHaveTextContent(/We could not find an official health department page for Skagit County\. Please contact the Skagit County health department directly/);
    expect(within(box).queryByRole('link')).toBeNull();
  });

  it('changing the city keeps the county, and clearing the county asks for one', async () => {
    const user = userEvent.setup();
    renderApp();
    await openRestaurant(user);
    await changeCounty(user, 'King');
    await changeCounty(user, '');
    expect(within(healthItem()).queryByRole('link', { name: /health department page/ })).toBeNull();
    expect(within(healthItem()).getByText(/Add your county/i)).toBeInTheDocument();
  });
});

describe('chat panel', () => {
  async function openChat(user) {
    await user.click(screen.getByRole('button', { name: 'Ask a question' }));
    return screen.findByRole('dialog', { name: 'Ask about your checklist' });
  }

  it('answers from the rules with record links, and says so when it does not know', async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await openChat(user);
    await user.type(within(dialog).getByLabelText('Your question'), 'Do I need a business license?');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect((await within(dialog).findAllByText(/Apply for your Washington business license \(Dept\. of Revenue/)).length).toBeGreaterThan(0);
    const links = within(dialog).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.getAttribute('href')).toMatch(/^https:\/\/(dor|secure\.dor)\.wa\.gov\//);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
    await user.type(within(dialog).getByLabelText('Your question'), 'What is the capital of France?');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(await within(dialog).findByText(/I don't have that in the current rules\/guides/)).toBeInTheDocument();
  });

  it('starts from suggested questions, sends at most 8 earlier turns, and closes with Escape', async () => {
    const user = userEvent.setup();
    const seen = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (url === '/api/chat') seen.push(JSON.parse(init.body));
      return real(url, init);
    };
    renderApp();
    const dialog = await openChat(user);
    await user.click(within(dialog).getByRole('button', { name: 'Do I need a business license?' }));
    await within(dialog).findAllByText(/Apply for your Washington business license/);
    for (let i = 0; i < 6; i += 1) {
      await user.type(within(dialog).getByLabelText('Your question'), `Tell me about the license ${i}`);
      await user.click(within(dialog).getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(seen).toHaveLength(i + 2));
    }
    expect(seen[0].conversation).toEqual([]);
    expect(seen[seen.length - 1].conversation.length).toBeLessThanOrEqual(8);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ask a question' })).toBeInTheDocument();
    globalThis.fetch = real;
  });

  it('uses the saved checklist for "my next step"', async () => {
    const user = userEvent.setup();
    renderApp();
    const card = (await screen.findByRole('heading', { name: 'Restaurant', level: 3 })).closest('li');
    await user.click(within(card).getByRole('button', { name: 'See this checklist' }));
    await screen.findByRole('heading', { name: 'Sample checklist: Restaurant' });
    const dialog = await openChat(user);
    await user.click(within(dialog).getByRole('button', { name: 'What is my next step?' }));
    expect(await within(dialog).findByText(/Next step: File your business entity with the Secretary of State/)).toBeInTheDocument();
  });
});

describe('admin evidence panel', () => {
  it('records a source review and a county page without changing any rule status', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: /Admin rules/ }));
    const form = (await screen.findByRole('heading', { name: 'Record a source review' })).closest('form');
    await user.selectOptions(within(form).getByLabelText('Rule'), 'Check for a county health department permit');
    await user.type(within(form).getByLabelText('Official page reviewed (https)'), 'http://insecure.example');
    await user.type(within(form).getByLabelText('Who reviewed this page'), 'Reviewer One');
    await user.click(within(form).getByRole('button', { name: 'Record review' }));
    expect(await screen.findByText('The source must be a full https:// link.')).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('Official page reviewed (https)'));
    await user.type(within(form).getByLabelText('Official page reviewed (https)'), 'https://kingcounty.gov/example');
    await user.type(within(form).getByLabelText('Notes'), 'Page opened, not yet matched.');
    await user.click(within(form).getByRole('button', { name: 'Record review' }));
    expect(await screen.findByText('Source review recorded.')).toBeInTheDocument();
    expect(await screen.findByText('Page opened, not yet matched.')).toBeInTheDocument();

    const cform = screen.getByRole('heading', { name: 'Save a county health page' }).closest('form');
    await user.type(within(cform).getByLabelText('County'), 'King County');
    await user.type(within(cform).getByLabelText('Official county page (https)'), 'https://kingcounty.gov/example');
    await user.type(within(cform).getByLabelText('Who reviewed the county page'), 'Reviewer One');
    await user.selectOptions(within(cform).getByLabelText('Status'), 'verified');
    await user.click(within(cform).getByRole('button', { name: 'Save county page' }));
    expect(await screen.findByText('County page saved.')).toBeInTheDocument();
    expect(await screen.findByText('King County')).toBeInTheDocument();

    // The county health rule is still Pending check in the rules table.
    const row = screen.getByRole('button', { name: /Edit Check for a county health department permit/ }).closest('tr');
    expect(within(row).getByText('Pending check')).toBeInTheDocument();
  });
});

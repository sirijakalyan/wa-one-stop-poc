import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AppProvider } from '../AppContext.jsx';
import { setSession } from '../api.js';
import { createService } from '../../../server/src/service.js';
import { createCognitoIdp } from '../../../server/src/cognito.js';
import { createMemoryStore } from './mockServer.js';
import { fakeCognito } from '../../../server/test/fakeCognito.js';

// The same screens, talking to a service whose people live in a (fake) AWS Cognito user pool: emailed codes, no reset links.
beforeEach(() => {
  window.scrollTo = () => {};
  setSession('');
  const f = fakeCognito();
  const idp = createCognitoIdp({ userPoolId: 'us-east-1_TEST', clientId: 'cid', client: f.client, verifier: f.verifier });
  const service = createService(createMemoryStore(), { idp });
  globalThis.fetch = async (url, init = {}) => {
    const h = new Headers(init.headers || {});
    const ctx = { visitor: h.get('x-visitor-id') || undefined, session: (/^Bearer (\S+)$/.exec(h.get('authorization') || '') || [])[1] || '' };
    const r = await service.handle((init.method || 'GET').toUpperCase(), url, init.body ? JSON.parse(init.body) : undefined, ctx);
    return { ok: r.status < 300, status: r.status, json: async () => r.body };
  };
});

const renderApp = () => render(<MemoryRouter initialEntries={['/']}><AppProvider><App /></AppProvider></MemoryRouter>);

describe('sign in through AWS Cognito', () => {
  it('sign up asks for the emailed code, then signs the person in', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('link', { name: 'Create account' })[0]);
    await user.type(await screen.findByLabelText('Your name'), 'Ana Rivera');
    await user.type(screen.getByLabelText('Email address'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'Passw0rdOK');
    await user.type(screen.getByLabelText('Confirm password'), 'Passw0rdOK');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('6-digit code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Confirm and sign in' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That code is not right'));
    await user.clear(screen.getByLabelText('6-digit code'));
    await user.type(screen.getByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm and sign in' }));
    expect(await screen.findByRole('button', { name: /Account: Ana Rivera/ })).toBeInTheDocument();
  });

  it('forgot password: enter the emailed code and a new permanent password, then sign in', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('link', { name: 'Create account' })[0]);
    await user.type(await screen.findByLabelText('Your name'), 'Ana');
    await user.type(screen.getByLabelText('Email address'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'Passw0rdOK');
    await user.type(screen.getByLabelText('Confirm password'), 'Passw0rdOK');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm and sign in' }));
    await user.click(await screen.findByRole('button', { name: /Account: Ana/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await user.click((await screen.findAllByRole('link', { name: 'Sign in' }))[0]);
    await user.click(await screen.findByRole('link', { name: 'Forgot your password?' }));
    await user.type(await screen.findByLabelText('Email address'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    await user.click(await screen.findByRole('link', { name: 'Enter the code' }));
    expect(await screen.findByLabelText('Email address')).toHaveValue('ana@example.com');
    await user.type(screen.getByLabelText('6-digit code'), '654321');
    await user.type(screen.getByLabelText('New password'), 'BrandNew123');
    await user.type(screen.getByLabelText('Confirm new password'), 'BrandNew123');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    await user.click(await screen.findByRole('link', { name: 'Sign in with your new password' }));
    await user.type(await screen.findByLabelText('Email address'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'BrandNew123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('button', { name: /Account: Ana/ })).toBeInTheDocument();
  });
});

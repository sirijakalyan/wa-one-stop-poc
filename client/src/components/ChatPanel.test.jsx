import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPanel from './ChatPanel.jsx';
import { api } from '../api.js';

describe('ChatPanel friendly states', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('empty state is warm and keeps the suggested questions', async () => {
    render(<ChatPanel />);
    await userEvent.click(screen.getByRole('button', { name: /Ask a question/ }));
    expect(screen.getByText(/Hi, I can help/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What is my next step?' })).toBeInTheDocument();
  });

  it('a server or proxy failure shows a calm message with Try again, and retry recovers', async () => {
    const err = Object.assign(new Error('We could not reach the server just now. Please try again in a moment.'), { unreachable: true });
    const spy = vi.spyOn(api, 'chat').mockRejectedValueOnce(err).mockResolvedValueOnce({ answer: 'Here is the answer.', links: [], matched: [] });
    render(<ChatPanel />);
    await userEvent.click(screen.getByRole('button', { name: /Ask a question/ }));
    await userEvent.click(screen.getByRole('button', { name: 'What is my next step?' }));
    expect(await screen.findByText("Couldn't reach the helper just now. Please try again in a moment.")).toBeInTheDocument();
    expect(screen.queryByText(/proxy|502|ECONN|undefined|Is it running/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Here is the answer.')).toBeInTheDocument();
    // the failed turn is gone and was never sent as history
    await waitFor(() => expect(screen.queryByText(/Couldn't reach the helper/)).toBeNull());
    expect(spy.mock.calls[1][1]).toEqual([]);
    expect(screen.getAllByText('What is my next step?').length).toBe(1);
  });

  it('rate limits get a plain message and clear validation errors keep their reason', async () => {
    vi.spyOn(api, 'chat')
      .mockRejectedValueOnce(Object.assign(new Error('Too many requests'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('Keep the question under 500 characters.'), { status: 400 }));
    render(<ChatPanel />);
    await userEvent.click(screen.getByRole('button', { name: /Ask a question/ }));
    await userEvent.click(screen.getByRole('button', { name: 'What is my next step?' }));
    expect(await screen.findByText('You are asking quickly. Please wait a minute and try again.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Keep the question under 500 characters.')).toBeInTheDocument();
  });
});

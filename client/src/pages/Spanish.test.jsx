import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AppProvider } from '../AppContext.jsx';
import { installMockServer } from '../artifact/mockServer.js';

// Spanish through the real screens and the real guide logic. The Spanish text is a draft pending review by a person.
beforeEach(() => {
  window.scrollTo = () => {};
  try { window.localStorage.clear(); } catch { /* ignore */ }
  installMockServer();
});
afterEach(() => {
  delete window.SpeechSynthesisUtterance;
  delete window.speechSynthesis;
  delete window.webkitSpeechRecognition;
  try { window.localStorage.clear(); } catch { /* ignore */ }
});

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProvider>
        <App />
      </AppProvider>
    </MemoryRouter>
  );
}
const logOf = async () => within(await screen.findByRole('log', { name: 'Conversación con la guía' }));
const tap = async (user, name) => user.click(await screen.findByRole('button', { name }));
const toSpanish = async (user) => user.click(await screen.findByRole('button', { name: 'Cambiar a español' }));

describe('Spanish', () => {
  it('the language button switches the home page, the labels and the page language, and says the text is a draft', async () => {
    const user = userEvent.setup();
    renderAt('/');
    expect(screen.getByTestId('greeting')).toHaveTextContent("Hi, I'm here to help");
    await toSpanish(user);
    expect(screen.getByTestId('greeting')).toHaveTextContent('Hola, estoy aquí para ayudarle a iniciar su negocio en Washington');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Inicie su negocio en Washington');
    const ways = within(screen.getByRole('list', { name: 'Elija cómo empezar' }));
    expect(ways.getByRole('button', { name: 'Hablar con la guía' })).toBeInTheDocument();
    expect(ways.getByRole('button', { name: 'Escribir' })).toBeInTheDocument();
    expect(ways.getByRole('button', { name: 'Usar el formulario paso a paso' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/Traducción preliminar al español, pendiente de revisión por una persona/);
    expect(document.documentElement.lang).toBe('es');
    expect(window.localStorage.getItem('wa-onestop-lang')).toBe('es');
    // And back.
    await user.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByTestId('greeting')).toHaveTextContent("Hi, I'm here to help");
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('a Spanish sample starts the guide in Spanish: Spanish read-back, Spanish chips, Spanish questions', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await toSpanish(user);
    await user.click(await screen.findByRole('button', { name: /Restaurante/ }));
    const log = await logOf();
    expect(await log.findByText(/^Entendí:/)).toBeInTheDocument();
    expect(log.getByText(/Servicio de comida/)).toBeInTheDocument();
    expect(log.getByText(/Bellevue, Condado de King/)).toBeInTheDocument();
    expect(log.getByText(/contratará a 8 personas dentro de 90 días/)).toBeInTheDocument();
    expect(screen.getByText('Su negocio')).toBeInTheDocument();
    await tap(user, 'Sí, es correcto');
    expect(await screen.findByText('Cobra impuesto sobre las ventas')).toBeInTheDocument();
    expect(screen.getByText(/de 8 confirmados/)).toBeInTheDocument();
    expect(await (await logOf()).findByText(/subcontratistas o contratistas independientes/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'No estoy seguro' })).toBeInTheDocument();
  });

  it('answers by voice or typing in Spanish, and "guardar mi plan" saves the plan', async () => {
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'type', start: 'Quiero abrir una panadería en Tacoma y contratar a dos personas' } });
    window.localStorage.setItem('wa-onestop-lang', 'es');
    // The page was opened before the choice was stored, so choose Spanish on screen.
    await toSpanish(user);
    const input = await screen.findByLabelText(/Cuéntele a la guía sobre su negocio/);
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, 'sí es correcto{Enter}');
    const answers = [['sociedad', /organizado/], ['no', /subcontratistas/], ['sí', /impuesto sobre las ventas/], ['sí', /\$12,000/], ['no', /nombre distinto/]];
    for (const [say, question] of answers) {
      await (await logOf()).findByText(question);
      await user.type(screen.getByLabelText(/Cuéntele a la guía sobre su negocio/), `${say}{Enter}`);
    }
    expect(await (await logOf()).findByText(/Eso es todo lo que necesito/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar mi plan' })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Cuéntele a la guía sobre su negocio/), 'guardar mi plan{Enter}');
    expect(await screen.findByRole('heading', { name: /lista de ejemplo/i })).toBeInTheDocument();
  });

  it('answers a Spanish question from the rules and says the agency text is in English', async () => {
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'type' } });
    await toSpanish(user);
    await user.type(await screen.findByLabelText(/Cuéntele a la guía sobre su negocio/), '¿Necesito una licencia comercial?{Enter}');
    const log = await logOf();
    expect(await log.findByText(/Esta respuesta viene de las reglas y guías oficiales, que por ahora están en inglés/)).toBeInTheDocument();
    expect(log.getAllByText(/business license/i).length).toBeGreaterThan(0);
  });

  it('switching language in the middle of the conversation asks the current question again in the new language', async () => {
    const user = userEvent.setup();
    renderAt({ pathname: '/guide', state: { mode: 'type', start: 'I want to open a food truck in Spokane and hire two people.' } });
    const logEn = within(await screen.findByRole('log', { name: 'Conversation with the guide' }));
    expect(await logEn.findByText(/^I heard:/)).toBeInTheDocument();
    await toSpanish(user);
    const log = await logOf();
    expect(await log.findByText(/^Entendí:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sí, es correcto' })).toBeInTheDocument();
  });

  it('every page changes language, not only the guide', async () => {
    const user = userEvent.setup();
    renderAt('/questionnaire');
    await toSpanish(user);
    expect(await screen.findByText('¿Cómo se organizará su negocio?')).toBeInTheDocument();
    expect(screen.getByText('Propietario único')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('link', { name: 'Iniciar sesión' })[0]);
    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hacer una pregunta' }));
    expect(screen.getByText('Pregunte sobre su lista de pasos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  describe('voice', () => {
    class FakeRec {
      constructor() { FakeRec.last = this; }
      start() { this.started = true; }
      abort() { this.started = false; }
      stop() { this.started = false; }
    }
    let uttered;
    beforeEach(() => {
      uttered = [];
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
      window.speechSynthesis = {
        speak: vi.fn((u) => { uttered.push(u); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 0); }),
        cancel: vi.fn(),
        getVoices: () => [
          { name: 'Microsoft Zira', lang: 'en-US', localService: true },
          { name: 'Google español', lang: 'es-US', localService: false },
          { name: 'Microsoft Sabina', lang: 'es-MX', localService: true },
        ],
      };
      window.webkitSpeechRecognition = FakeRec;
      FakeRec.last = null;
    });

    it('speaks Spanish with a Spanish voice, and listens for Spanish', async () => {
      const user = userEvent.setup();
      renderAt('/');
      await toSpanish(user);
      // Talk is the default: switching language repeats the greeting in Spanish and the microphone is already on.
      await waitFor(() => expect(uttered.some((u) => /^Hola, estoy aquí para ayudarle/.test(u.text))).toBe(true));
      const es = uttered.find((u) => /^Hola, estoy aquí para ayudarle/.test(u.text));
      expect(es.lang).toBe('es-US');
      expect(es.voice.name).toBe('Microsoft Sabina');
      expect(screen.getByRole('button', { name: 'Silenciar voz' })).toBeInTheDocument();
      await waitFor(() => expect(FakeRec.last?.started).toBe(true));
      expect(FakeRec.last.lang).toBe('es-US');
    });

    it('does not read English agency text in a Spanish voice', async () => {
      const user = userEvent.setup();
      renderAt({ pathname: '/guide', state: { mode: 'talk' } });
      await toSpanish(user);
      await waitFor(() => expect(uttered.length).toBeGreaterThan(0));
      uttered.length = 0;
      await user.type(await screen.findByLabelText(/Cuéntele a la guía sobre su negocio/), '¿Necesito una licencia comercial?{Enter}');
      await waitFor(() => expect(uttered.some((u) => /están en inglés\. Puede leerla en la pantalla/.test(u.text))).toBe(true));
      expect(uttered.some((u) => /Washington business license/.test(u.text))).toBe(false);
    });

    it('switching language while the guide talks says the greeting again in the new language, both ways', async () => {
      const user = userEvent.setup();
      renderAt({ pathname: '/guide', state: { mode: 'talk' } });
      await waitFor(() => expect(uttered.length).toBeGreaterThan(0));
      expect(uttered[0].text).toMatch(/^Hi, I'm here to help/);
      uttered.length = 0;
      await toSpanish(user);
      await waitFor(() => expect(uttered.some((u) => /^Hola, estoy aquí para ayudarle/.test(u.text) && u.lang === 'es-US')).toBe(true));
      uttered.length = 0;
      await user.click(screen.getByRole('button', { name: 'Switch to English' }));
      await waitFor(() => expect(uttered.some((u) => /^Hi, I'm here to help/.test(u.text) && u.lang === 'en-US')).toBe(true));
    });

    it('switching language in the middle of the conversation speaks the question in the new language', async () => {
      const user = userEvent.setup();
      renderAt({ pathname: '/guide', state: { mode: 'talk', start: 'I want to open a food truck in Spokane and hire two people.' } });
      await waitFor(() => expect(uttered.some((u) => /I heard/.test(u.text))).toBe(true));
      uttered.length = 0;
      await toSpanish(user);
      await waitFor(() => expect(uttered.some((u) => /Entendí/.test(u.text) && u.lang === 'es-US')).toBe(true));
    });

    it('says so on screen when the device has no Spanish voice', async () => {
      window.speechSynthesis.getVoices = () => [{ name: 'Microsoft Zira', lang: 'en-US', localService: true }];
      const user = userEvent.setup();
      renderAt({ pathname: '/guide', state: { mode: 'talk' } });
      await toSpanish(user);
      expect(await screen.findByText(/no tiene una voz en español instalada/)).toBeInTheDocument();
    });
  });
});
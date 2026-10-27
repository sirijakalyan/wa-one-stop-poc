import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import ChatPanel from './ChatPanel.jsx';
import WakeNotice from './WakeNotice.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const first = useRef(true);

  // Move focus to the main area after navigation so keyboard and screen-reader users land on new content.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus();
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to main content</a>
      <Header />
      <main id="main" ref={mainRef} tabIndex={-1}>
        <div className="wrap">
          <Outlet />
        </div>
      </main>
      <Footer />
      <ChatPanel />
      <WakeNotice />
    </div>
  );
}

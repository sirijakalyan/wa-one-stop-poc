import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from './AppContext.jsx';
import { useT } from './i18n.js';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Guide from './pages/Guide.jsx';
import Questionnaire from './pages/Questionnaire.jsx';
import MyBusiness from './pages/MyBusiness.jsx';
import Notifications from './pages/Notifications.jsx';
import Admin from './pages/Admin.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import NotFound from './pages/NotFound.jsx';

// When the server says the site needs an account, signed-out visitors only see the sign in, sign up and password pages.
function RequireAccount() {
  const { user, authReady, requireLogin } = useApp();
  const t = useT();
  const loc = useLocation();
  if (requireLogin === null || !authReady) return <p className="page-loading" role="status">{t('auth.loading')}</p>;
  // An admin account only works in the Admin area: no home page, business pages or alerts.
  if (user?.role === 'admin' && loc.pathname !== '/admin') return <Navigate to="/admin" replace />;
  // Home, the guide and the form stay open to visitors; the sign in page appears when they save a plan or open a page that needs an account.
  const open = ['/', '/home', '/guide', '/questionnaire'].includes(loc.pathname);
  if (requireLogin && !user && !open) {
    const from = loc.pathname === '/' ? undefined : `${loc.pathname}${loc.search}`;
    return <Navigate to="/login" replace state={from ? { from } : undefined} />;
  }
  return <Outlet />;
}

// The address "/" is the front door. With the account gate on it sends signed-out visitors to Sign in and signed-in owners to /home.
function FrontDoor() {
  const { user, requireLogin } = useApp();
  const loc = useLocation();
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (!requireLogin || !user) return <Landing />;
  return <Navigate to={user ? '/home' : '/login'} replace state={user ? loc.state : undefined} />;
}

// Layout wraps every route, including the not-found page, so the
// demo disclaimer banner is present on every screen.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<RequireAccount />}>
        <Route index element={<FrontDoor />} />
        <Route path="home" element={<Landing />} />
        <Route path="guide" element={<Guide />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="my-business" element={<MyBusiness />} />
        {/* Old addresses keep working: bookmarks and links go to the combined page. */}
        <Route path="checklist" element={<Navigate to="/my-business" replace />} />
        <Route path="dashboard" element={<Navigate to="/my-business" replace />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin" element={<Admin />} />
        </Route>
        {/* Sources moved into Admin: it is an editing tool for content owners, not something owners need to read. */}
        <Route path="sources" element={<Navigate to="/admin" replace />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

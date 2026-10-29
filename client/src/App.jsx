import { Routes, Route, Navigate } from 'react-router-dom';
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

// Layout wraps every route, including the not-found page, so the
// demo disclaimer banner is present on every screen.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="guide" element={<Guide />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="my-business" element={<MyBusiness />} />
        {/* Old addresses keep working: bookmarks and links go to the combined page. */}
        <Route path="checklist" element={<Navigate to="/my-business" replace />} />
        <Route path="dashboard" element={<Navigate to="/my-business" replace />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin" element={<Admin />} />
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

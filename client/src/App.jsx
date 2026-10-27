import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Questionnaire from './pages/Questionnaire.jsx';
import Checklist from './pages/Checklist.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Notifications from './pages/Notifications.jsx';
import Admin from './pages/Admin.jsx';
import Sources from './pages/Sources.jsx';
import NotFound from './pages/NotFound.jsx';

// Layout wraps every route, including the not-found page, so the
// demo disclaimer banner is present on every screen.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="checklist" element={<Checklist />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin" element={<Admin />} />
        <Route path="sources" element={<Sources />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

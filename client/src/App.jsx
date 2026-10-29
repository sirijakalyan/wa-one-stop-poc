import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Guide from './pages/Guide.jsx';
import Questionnaire from './pages/Questionnaire.jsx';
import MyBusiness from './pages/MyBusiness.jsx';
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
        <Route path="guide" element={<Guide />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="my-business" element={<MyBusiness />} />
        {/* Old addresses keep working: bookmarks and links go to the combined page. */}
        <Route path="checklist" element={<Navigate to="/my-business" replace />} />
        <Route path="dashboard" element={<Navigate to="/my-business" replace />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin" element={<Admin />} />
        <Route path="sources" element={<Sources />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

// One list drives the router, the navigation and the tests.
export const ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/guide', label: 'AI guide' },
  { path: '/questionnaire', label: 'Questionnaire' },
  { path: '/checklist', label: 'My checklist' },
  { path: '/dashboard', label: 'Progress' },
  { path: '/notifications', label: 'Notifications' },
  { path: '/sources', label: 'Sources' },
  // Reachable at /admin and from the footer. Kept out of the owner navigation.
  { path: '/admin', label: 'Admin rules', nav: false },
];

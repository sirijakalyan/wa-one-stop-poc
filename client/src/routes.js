// One list drives the router, the navigation and the tests.
export const ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/my-business', label: 'My business' },
  { path: '/sources', label: 'Sources' },
  // Still reachable by address and from the home page. The notification bell opens the notifications.
  { path: '/guide', label: 'AI guide', nav: false },
  { path: '/questionnaire', label: 'Questionnaire', nav: false },
  { path: '/notifications', label: 'Notifications', nav: false },
  // Reachable at /admin and from the footer. Kept out of the owner navigation.
  { path: '/admin', label: 'Admin rules', nav: false },
];

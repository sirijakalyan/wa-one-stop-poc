import '@testing-library/jest-dom/vitest';

// The tests run the site open to visitors. Tests of the account gate set this to true themselves.
globalThis.__WA_REQUIRE_LOGIN__ = false;

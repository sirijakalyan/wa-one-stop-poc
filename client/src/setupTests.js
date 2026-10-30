import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// findBy/waitFor wait up to 10s (default 1s) so a slow machine does not fail a test that is only waiting.
configure({ asyncUtilTimeout: 10000 });

// The tests run the site open to visitors. Tests of the account gate set this to true themselves.
globalThis.__WA_REQUIRE_LOGIN__ = false;

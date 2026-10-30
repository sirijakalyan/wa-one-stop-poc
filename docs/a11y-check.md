# Accessibility check before you deploy

Run this from the project folder before you commit:

```
npm install
npx playwright install chromium     # first time only, about 150 MB
npm run a11y
```

It takes about 2 minutes and does everything for you:

1. Builds the client and starts the site on your computer with a **throwaway data folder** (your real data in
   `server/data` is never touched).
2. Creates a demo owner with a saved plan and a demo admin.
3. Scans every page with axe-core 4.12.1, the same engine SureAccess uses, signed out, as an owner and as an admin,
   on a desktop and a phone screen. It also opens the chat pop-up, the admin step editor and the Add a step form.
4. Loads the real web fonts. Fonts change text sizes, and one finding only showed up with them.

Result: **exit code 0 = CLEAN**, 1 = fix the items printed above (each shows the exact element).

Options: `--skip-build` (reuse `client/dist`), `--allow-review` (do not fail on needs-review items),
`--strict` (also fail on advisory notes about the chat pop-up), `--verbose` (print every page).

What it cannot do: prove conformance. It checks what a machine can check (WCAG 2.2 AA-aligned rules). SureAccess
can still differ slightly because its browser and timing differ, and a person still reviews the rest.

## Stop a bad deploy automatically (GitHub Actions)

Add these two steps to the job in `.github/workflows/` **after "Build client" and before "Package"**:

```yaml
      - name: Install browser for accessibility check
        run: npx playwright install --with-deps chromium

      - name: Accessibility check
        run: npm run a11y -- --skip-build
```

If the check finds a problem the run turns red and nothing is deployed.

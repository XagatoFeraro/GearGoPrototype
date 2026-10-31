# Gear Go Automobiles — interactive prototype

A local-first demo of a proposed multi-brand car service experience: public site,
booking journey, customer portal, garage operations and a technician workspace.
Everything is synthetic and stored in `localStorage`; there is no server, build
step or dependency install.

## Run it

Open `index.html` in a modern desktop browser. Keep the `assets/` folder next to
it — it contains all styles and scripts.

## Structure

```
index.html                 Page metadata, body shell, stylesheet + script tags
assets/css/
  site.css                 Tokens, reset, typography, public-site styles
  app.css                  App shell, portal, operations, booking, overlays
  responsive.css           Width breakpoints and reduced-motion overrides
  print.css                Print styles for invoices and job sheets
assets/js/
  core.js                  Constants, helpers, icons, seed config, permissions,
                           domain calculations
  store.js                 localStorage, schema normalisation, session state,
                           inventory reservations, seed data, UI primitives
  ui.js                    Shared components, navigation, shells, charts
  site.js                  Marketing pages, policies, public tracking
  booking.js               Multi-step booking journey and submission
  portal.js                Customer portal, login screen, sign-in flow
  ops.js                   Garage dashboard, jobs, estimates, inventory, money
  tech.js                  Technician workspace, QC, demo views, access denied
  router.js                Hash router, auth guards, view resolution, render boundary
  actions.js               Delegated click-action handlers
  forms.js                 Delegated form handlers and workflow mutations
  boot.js                  Global search, event wiring, startup
```

The scripts are classic (non-module) files loaded in the order above and share
one global scope, exactly like the original single-file build. **Keep that order**
when adding or moving code: later files rely on bindings declared earlier.

## Auth and entry routing

- Every customer portal, garage operations and workshop URL is guarded by the
  router. Opening one without the right signed-in role redirects to
  `/login?next=<intended-route>` before anything is rendered.
- The login screen filters identities by destination: customer routes show
  customers, `/ops` and `/tech` show staff. A link lets you switch intent.
- Sign-in is simulated and role-aware. A non-technician choosing a workshop
  destination lands in operations; a technician lands in the workshop; a
  customer can only reach the portal. There is no silent identity switching.
- Demo persona buttons and tracking shortcuts route through login and can
  pre-select a persona (`/login?next=…&as=staff:st_owner`).
- Signing out clears the session and returns to the public site.

## Data

- Key: `geargo.prototype.v1` (schema version 2), with a best-effort backup under
  `geargo.prototype.v1.backup`.
- Use **Demo controls** (`#/demo`) to reset seed data, export the database or
  simulate failures. All records are fictional; do not enter real information.

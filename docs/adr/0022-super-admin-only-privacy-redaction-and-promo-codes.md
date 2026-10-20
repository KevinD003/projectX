# ADR 0022 — Privacy redaction and promo codes are super-admin-only across tenants

- **Status:** Accepted
- **Date:** 2026-10-20
- **Amends:** ADR 0018 decision 2 (the platform administrator holds every
  capability except a named super-admin-only list). It does not touch ADR 0018
  decision 3: platform `ADMIN` still admits at the door.
- **Related:** `packages/permissions/src/capabilities.js`
  (`SUPER_ADMIN_ONLY_CAPABILITIES`, `PLATFORM_ADMINISTRATOR_CAPABILITIES`,
  `assertPlatformAdministratorBounds`), `apps/api/src/routes/privacy.js`,
  `apps/api/src/routes/promo-codes.js`, `docs/SECURITY.md`,
  `docs/PRIVACY_AND_RETENTION.md`, the `privacy.*` and `promo-codes.*` route
  descriptions in `packages/api-contract/src/routes.js`.

## Context

The owner's security assessment confirmed, against the running code, that a
platform administrator (`ADMIN`) — not a super administrator, and never a member
of the organisation — could, in any tenant:

- irreversibly redact an organiser's buyer PII
  (`POST /v1/organizations/:id/privacy/requests` and its confirm), and
- mint promo codes, including a 100%-off code, against an organiser's revenue
  (`POST /v1/organizations/:id/promo-codes`).

This followed from ADR 0018 decision 2. `SUPER_ADMIN_ONLY_CAPABILITIES` held only
`platform:role_manage`, so `PLATFORM_ADMINISTRATOR_CAPABILITIES = ALL −
SUPER_ADMIN_ONLY` included `privacy:redact` and `promo:manage`. Because `decide()`
in `can.js` tests the platform-role capabilities before any organisation lookup,
a platform administrator passed the capability gate in **every** organisation,
and the privacy and promo-codes handlers carried no in-handler membership gate.

The behaviour contradicted four authoritative documents, which all promised the
opposite (owner-only; "equally not `platform:admin`"; the contract's "owner
alone"). The owner was asked to reconcile the contradiction and chose to tighten
the scope rather than to accept the reach.

## Decision

1. **`privacy:redact` and `promo:manage` become super-admin-only across
   tenants.** Both join `SUPER_ADMIN_ONLY_CAPABILITIES`, now three entries:
   `platform:role_manage` (ADR 0018), `privacy:redact` and `promo:manage`.
   `PLATFORM_ADMINISTRATOR_CAPABILITIES` is still `ALL_CAPABILITIES −
SUPER_ADMIN_ONLY_CAPABILITIES`, so a platform administrator no longer holds
   either through its platform role. `assertPlatformAdministratorBounds` stays
   an exact equality against that derivation and refuses a table that hands
   `ADMIN` any of the three. A super administrator keeps both through
   `ALL_CAPABILITIES`, so cross-tenant redaction and promo management remain a
   super administrator's — the chosen policy, not an oversight.

2. **They stay organisation capabilities.** Neither is added to
   `PLATFORM_ONLY_CAPABILITIES`. `privacy:redact` stays the organisation
   `OWNER`'s through a membership; `promo:manage` stays `EVENT_MANAGER` and up's.
   The scope tightening removes only the platform administrator's _cross-tenant_
   reach. A platform administrator who is a member of an organisation still
   exercises either there, through that membership, like any other member —
   which is why the fix is in the capability table and not an in-handler gate
   that would also block a super administrator.

3. **No new audit event, no in-handler gate.** The refusal is the ordinary
   capability check: a non-member platform administrator now fails the
   declarative `privacy:redact` / `promo:manage` guard and receives a 403 before
   the subject or the code is looked at. A super administrator passes it, exactly
   as before.

4. **The door is unchanged.** ADR 0018 decision 3 stands: platform `ADMIN`
   admits at any event's door on `PLATFORM_ROLE` authority, recorded as `ADMIN`.
   The stale contract descriptions that still said a platform administrator
   "admits nobody" (`tickets.previewAdmission`, `tickets.checkIn`) were corrected
   to match ADR 0018; this ADR makes no door change.

## Consequences

- The high and medium findings (buyer PII redaction and cross-tenant promo
  codes by a non-member platform administrator) are closed and regression-tested
  in `packages/permissions`, `apps/api/tests/privacy-commands.test.js` and
  `apps/api/tests/promo-codes.test.js`, and in the web offer model
  (`apps/web/src/lib/capabilities.test.js`, `navigation.test.js`).
- The web's `sessionCan` stand-in for `platform:admin` no longer answers for a
  super-admin-only capability, so the Privacy area and the workspace rail drop
  `Privacy` for a membership-less platform administrator while keeping it for a
  super administrator. `SUPER_ADMIN_ONLY_CAPABILITIES` in
  `apps/web/src/lib/capabilities.js` mirrors the permissions package's list
  (three entries), held equal by a test.
- `docs/SECURITY.md`, `docs/PRIVACY_AND_RETENTION.md`, the `privacy:redact`
  docstring and the `privacy.*` route descriptions were reconciled to the new
  truth: owner via membership, super administrator across tenants, never a
  platform administrator.
- A capability added later that should also stay with `SUPER_ADMIN` must be added
  to `SUPER_ADMIN_ONLY_CAPABILITIES` on purpose, and the load-time equality makes
  forgetting the derivation impossible — unchanged from ADR 0018.

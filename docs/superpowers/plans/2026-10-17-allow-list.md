# Google access through private ALLOW_LIST

User request: Google login enabled only for accounts in environment ALLOW_LIST. Default chosen: exact verified Google email addresses; never expose the list or Admin key to the client.

- [x] Verify email normalization, empty-list deny, verified Google provider and exact matching with test-first policy helper.
- [x] Add server-only Firebase Admin using FIREBASE_ADMIN_KEY (same convention as BacaroGame), verify ID tokens and auto-provision members.
- [x] Enforce policy in Firestore rules, not just the UI; deny legacy membership, unverified/password users and removed entries.
- [x] Authoritative access:sync command publishes env policy. Runtime login cannot mutate policy; mismatch fails closed. build:deploy explicitly syncs on authoritative deployment; ordinary build is read-only.
- [x] Replace manual membership client gate with server verification and periodic session check; preserve existing CRUD.
- [x] Update env examples, README and implementation report. Run unit/rules, allowed/denied/revocation browser flows on desktop/mobile, typecheck, format and production build.

No secrets copied between projects, no remote rules or policy publication run. Local .env gets blank missing ALLOW_LIST/FIREBASE_ADMIN_KEY entries only. Integration tests use demo emulator exclusively. Publication must be run by the user after choosing allowed accounts and configuring Admin; a live env change alone cannot alter a Firestore ruleset.

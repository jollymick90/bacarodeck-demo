# SvelteKit pages implementation plan

> Use superpowers:executing-plans for integration; independent conductor migration may use superpowers:dispatching-parallel-agents.

**Goal:** Every application screen has a SvelteKit page, with working deep links, refresh and browser history.
**Spec:** User request: use only SvelteKit routing for every screen, including speaker details and scheduling in backoffice.
**Architecture:** A root workspace layout owns authentication and shared reactive data. Dedicated pages consume that context; navigation uses anchors or SvelteKit goto. No hash or manual history router. Local state remains for input drafts, filters and confirmation dialogs.
**Stack:** Existing Svelte 5, SvelteKit, Firebase; no new dependencies.

## Constraints and review focus
- Preserve persistent login, authorization gates and all existing data/write policies.
- Preserve user's untracked data/agenda/codemotion-speakers.json; no database migrations.
- Cold direct links wait for authorized data before checking entity existence.
- Switching entity IDs resets local form snapshots; polling never replaces an open draft.
- Missing entities and denied admin pages must have explicit feedback and an exit link.
- Prepared imports rebuild from route parameters on refresh; no navigation state required.
- Browser Back/Forward changes the screen and links can open in a new tab.

## Tasks
1. [ ] Write failing route acceptance tests; move auth/data lifecycle into per-layout Workspace state and shell. Root layout gates all page content and preserves one session across navigation.
2. [ ] Conductor: /, /speaker/[speakerId], /speaker/[speakerId]/scaletta, /topic and /topic/[topic]. Replace manual history and screen switches. Keep short edit/confirmation dialogs local.
3. [ ] Backoffice: /backoffice list; /backoffice/speaker/[speakerId] and /[section] for research/questions/interview/talk; /backoffice/programmazione; /backoffice/strumenti; explicit import/export/backup/tag/access pages; /backoffice/contenuti/[collection]/[id] and /backoffice/nuovo/[collection]. Speaker IDs and return destinations are URL data. Preserve unified readonly editor and IT/EN switch.
4. [ ] Update old query links via redirects. Replace toolbar commands with links. Adapt existing browser tests to URL navigation and assert deep reload, Back/Forward, route-to-route entity changes, access control and missing entities.
5. [ ] Run check, unit and browser suites, build, focused review; document paths and verification. Leave changes reviewable in this checkout without publishing.

## Shared interface
`getWorkspace()` from `$lib/workspace.svelte` returns per-layout state with reactive `data: Dataset`, `members: Entity[]`, `user: User|null`, `client: ReturnType<typeof getFirebase>`, `access`, `ready`, `superadmin`, `online`, `error`, `message`. Shell renders children only once authorized and ready. Pages use existing repository APIs for writes. The conductor worker owns only conductor components, conductor route files, and conductor tests; root owns layout/state/backoffice.

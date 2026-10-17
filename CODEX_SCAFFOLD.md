# PROMPT DA DARE A CODEX — Scaffold BacaroTech Interview Hub

You are implementing a real, usable mobile-first collaborative webapp called **BacaroTech Interview Hub**. This repository contains the definitive initial requirements and seed data. Read `README.md`, `START_HERE.md`, `docs/PRODUCT.md`, `docs/USER_FLOWS.md`, `docs/FIRESTORE_MODEL.md`, `docs/UI_SCREENS.md`, `docs/ACCEPTANCE.md`, `docs/DEPLOY_FIREBASE_VERCEL.md`, and `data/README.md` first.

## Context and stack

- Codemotion Milano, 28–29 October 2026; the app must be useful while preparing interviews by 27 October.
- SvelteKit + TypeScript, mobile-first Italian UI. Firebase Authentication (Google) + Cloud Firestore; deployed on Vercel with the Vercel adapter.
- Reuse an existing Firebase project if configured, but isolate this dataset under `/workspaces/codemotion-milano-2026`.
- A full product/backend is not needed. Do not add RAG, a built-in LLM, Cloud Functions, background scraping, vector DB, recording features, or heavy design systems.
- The first deployment must have **only 5 speakers** from `data/seed/seed_five.json`. The full 84-person catalog is reference data for later, NOT a first-run import.

## Critical editorial rules

1. **EVERY editorial field must be editable:** speaker bio/headline/org/photo/notes/tags, talk title/abstract/schedule, source URL/title/notes, Markdown body and notes, insight, question IT/EN/follow-up, interview assignment and statuses. Only technical IDs and system audit/timestamps can be immutable.
2. **No speaker contacts**: never import, add, show, or use the Email column from the original CSV; avoid email, phone, private addresses or other nonpublic personal details in speaker content.
3. Keep the source provenance. AI text is not a verified fact; clearly distinguish a reported fact, a member interpretation, and an editorial question.
4. Markdown pasted from Gemini or ChatGPT must be accepted **as-is**; allow pasting/saving even when the user has not filled tags, links or classification.
5. When importing a new JSON, validate against `schemas/speaker-research-import.schema.json`, show diff/preview, check duplicates, and make writes only after explicit approval. Existing approved questions, annotations and plans must not be silently overwritten.

## Build in checkpoints, keeping each one executable

A. **Foundation**: SvelteKit app, responsive layout, Google login, allowlisted Firestore members, `.env.example`, Firestore SDK, route guards and safe empty states. Integrate `firebase/firestore.rules` into existing Firebase rules; do NOT overwrite unrelated project rules.

B. **Core data and CRUD**: Firestore collections as in docs; read seed 5; list/filters/search by name and tags; speaker details; edit for all fields; CRUD for sources/materials/insights/questions/talks. Implement markdown textarea + readable preview. Use small forms that work on phone. An "Aggiungi materiale" CTA must be visually obvious.

C. **Interview workflow**: interviewer assignment from the member list, questions sorted and status, EN/IT toggle, free notes and prep state. All saved in Firestore.

D. **Import workflow**: paste JSON; JSON Schema validation (e.g. Ajv or Zod equivalent), explain errors, match on `targetSpeakerId` plus possible name duplicates, show field-level preview, create/update selected entities in one batch/transaction, always mark AI questions `suggested`. Provide cancel/undo strategy before writes, no blind replace.

E. **Polish and tests**: responsive test, forbidden-member security test, edit of a source URL and note, markdown 2k+ characters, concurrency protection using `revision` or a transaction, accessible controls, verification against `docs/ACCEPTANCE.md`. Keep the app deployable throughout.

## Read/write and safety details

- The data is a small collaborative workspace. Prefer understandable Svelte components/stores and clear Firestore repository functions over generic frameworks.
- Use Firebase client SDK with `PUBLIC_FIREBASE_*` variables and ensure SSR does not attempt browser Firebase Auth prematurely.
- Use Google Auth + Firestore membership. An authenticated user without a `members/{uid}` record must not read the dataset.
- All data writes should populate `createdAt`, `updatedAt`, `createdBy`, `updatedBy` and a revision, without clobbering previously written metadata.
- Offline: mobile online-first is fine for first scaffold. Cache recently visited speaker read-only if manageable; never silently queue conflicting offline edits. Explain missing offline data.
- For Material Markdown, enforce a soft 200 KiB UTF-8 limit with a useful message; never truncate silently.
- No automatic external fetch from untrusted pasted URLs. Render Markdown securely (sanitize or disable unsafe HTML) to prevent script injection.
- Duplicates: existing `speaker.id` and speaker name normalized (advisory), existing source URLs where possible. Do not conflate distinct people with the same name.

## Requested final output

- A working app scaffold in this repository with **working CRUD**, not placeholder buttons.
- A clear `IMPLEMENTATION_REPORT.md` with what changed, commands executed and test results, deploy configuration, pending tasks, and an honest list of incomplete acceptance criteria.
- Tests for essential CRUD validation and security rules where feasible.
- Do not implement the second phase (all 84 speakers) or deploy to a production Firebase/Vercel project without existing credentials and explicit project choice. Do not request or commit keys.

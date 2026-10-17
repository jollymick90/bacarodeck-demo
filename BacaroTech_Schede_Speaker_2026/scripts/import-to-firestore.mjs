#!/usr/bin/env node
/**
 * Import base speaker data to Firebase Firestore without overwriting human edits.
 * Run from a directory with firebase-admin installed, or install it next to the script.
 * Default: DRY RUN. --apply requires explicit FIREBASE_PROJECT_ID.
 *
 * node scripts/import-to-firestore.mjs --group=in
 * node scripts/import-to-firestore.mjs --group=out --apply
 * node scripts/import-to-firestore.mjs --speaker=andrey-breslav --apply
 * node scripts/import-to-firestore.mjs --file=import/01_speaker_in_elenco.json --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawArgs = process.argv.slice(2);
const value = (prefix) => rawArgs.find(x => x.startsWith(prefix))?.slice(prefix.length);
const allowed = rawArgs.every(x => x === '--apply' || x === '--help' || x.startsWith('--group=') || x.startsWith('--speaker=') || x.startsWith('--file='));
if (!allowed) throw new Error('Invalid argument. Use --help.');
if (rawArgs.includes('--help')) {
  process.stdout.write('Use --group=in|out|all, --speaker=<id>, --file=<relative-path>, and optionally --apply. Without --apply only validates and previews.\n');
  process.exit(0);
}
const group = value('--group=') ?? 'all';
if (!['in','out','all'].includes(group)) throw new Error('Unknown group: ' + group);
const filename = value('--file=') ?? ({in:'import/01_speaker_in_elenco.json',out:'import/02_speaker_fuori_elenco.json',all:'import/00_tutti_gli_speaker.json'})[group];
const absPath = path.resolve(root, filename);
if (!absPath.startsWith(root+path.sep)) throw new Error('File path must stay inside package');
const data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
if (data.schemaVersion !== 1 || data.workspaceId !== 'codemotion-milano-2026') throw new Error('Wrong schemaVersion or workspaceId');
if (rawArgs.filter(x=>x.startsWith('--speaker=')).length>1 || rawArgs.filter(x=>x.startsWith('--group=')).length>1 || rawArgs.filter(x=>x.startsWith('--file=')).length>1) throw new Error('Argument repeated');
const onlyId = value('--speaker=');
const speakers = (data.speakers ?? []).filter(s=> !onlyId || s.id===onlyId);
if (onlyId && speakers.length !== 1) throw new Error('Speaker not present in selected dataset: '+onlyId);
const speakerIds = new Set(speakers.map(s=>s.id));
const talks = (data.talks ?? []).filter(t=>t.speakerIds.some(id=>speakerIds.has(id)));
const plans = (data.interviewPlans ?? []).filter(p=>speakerIds.has(p.speakerId));
const sourceIds = new Set([...speakers,...talks].flatMap(x=>x.sourceIds ?? []));
const sources = (data.sources ?? []).filter(s=>sourceIds.has(s.id));
const collections = { sources, speakers, talks, interviewPlans:plans };
for (const [name, entries] of Object.entries(collections)) {
  const ids = new Set();
  for (const record of entries) {
    if (typeof record.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(record.id) || ids.has(record.id)) throw new Error('Invalid/duplicate document id: '+name+'/'+record.id);
    ids.add(record.id);
    for (const forbidden of ['email','phone','contactAddress']) if (forbidden in record) throw new Error('Forbidden personal contact: '+name+'/'+record.id);
  }
}
const apply = rawArgs.includes('--apply');
console.log(`${apply?'APPLY':'DRY RUN'} workspace=${data.workspaceId} group=${group} speaker=${onlyId ?? '(all)'}`);
for (const [name,entries] of Object.entries(collections)) console.log(`  ${name}: ${entries.length}`);
console.log('  materials/questions/insights: 0 (no research or prepared questions imported)');
if (!apply) {
  console.log('No writes performed. Add --apply to create missing documents.');
  process.exit(0);
}
if (!process.env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID is required for --apply');
const { initializeApp, applicationDefault } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
initializeApp({ credential:applicationDefault(), projectId:process.env.FIREBASE_PROJECT_ID });
const db = getFirestore();
const base = db.collection('workspaces').doc(data.workspaceId);
const workspaceData = {id:data.workspaceId,title:'BacaroTech — Codemotion Milano 2026',eventStart:'2026-10-28',eventEnd:'2026-10-29',preparationDeadline:'2026-10-27',notesMd:'',language:'it',status:'active'};
const items = [{ref:base,record:workspaceData}];
for (const [collection, entries] of Object.entries(collections)) {
  for (const record of entries) items.push({ref:base.collection(collection).doc(record.id), record});
}
let skipped=0, created=0;
// Check existing documents, then create only the missing ones. Creation itself uses
// Firestore's create precondition to avoid races that would overwrite an existing record.
const pending=[];
for (const item of items) {
  if ((await item.ref.get()).exists) skipped++;
  else pending.push(item);
}
for (let offset=0; offset<pending.length; offset+=300) {
  const batch=db.batch();
  const slice=pending.slice(offset,offset+300);
  for (const {ref,record} of slice) batch.create(ref,{...record,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),createdBy:'base-import',updatedBy:'base-import',revision:1});
  await batch.commit();
  created+=slice.length;
}
console.log(`Created ${created}, skipped ${skipped} existing documents, overwritten 0.`);

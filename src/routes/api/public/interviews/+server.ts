import { error, json } from '@sveltejs/kit';
import { getAdmin } from '$lib/server/firebase-admin';
import { readCollection } from '$lib/server/firestore-cache';
import type { Entity } from '$lib/fields';
import type { RequestHandler } from './$types';

// An explicit field list keeps member data and future internal fields out of this public feed.
const publicFields = {
  speakers: [
    'id',
    'fullName',
    'firstName',
    'lastName',
    'headline',
    'organization',
    'biographyMd',
    'biographyIt',
    'biographyEn',
    'photoUrl',
    'tags',
    'talkIds',
    'inInterviewList',
    'isKeynote',
    'status'
  ],
  talks: [
    'id',
    'speakerIds',
    'title',
    'abstractMd',
    'abstractIt',
    'abstractEn',
    'language',
    'topic',
    'level',
    'day',
    'time',
    'endTime',
    'stage'
  ],
  questions: [
    'id',
    'speakerId',
    'order',
    'textIt',
    'textEn',
    'followUpIt',
    'followUpEn',
    'whyMd',
    'tags',
    'status',
    'notesMd'
  ],
  interviewPlans: [
    'id',
    'speakerId',
    'assignedTeamId',
    'status',
    'interviewStatus',
    'interviewLanguage',
    'targetQuestions',
    'date',
    'startTime'
  ],
  conductorBriefs: [
    'id',
    'speakerId',
    'talkId',
    'mainQuestionIds',
    'optionalQuestionIds',
    'classicQuestionIds'
  ]
} as const;

export const GET: RequestHandler = async ({ url }) => {
  const speakerId = url.searchParams.get('speakerId');
  if (speakerId !== null && !/^[a-zA-Z0-9_-]{1,128}$/.test(speakerId))
    error(400, 'ID speaker non valido.');

  const { db } = getAdmin();
  const entries = await Promise.all(
    Object.entries(publicFields).map(async ([collection, keys]) => {
      const entities = (await readCollection(db, collection)) as Entity[];
      const selected =
        speakerId === null
          ? entities
          : entities.filter((entity) => {
              if (collection === 'speakers') return entity.id === speakerId;
              if (collection === 'talks')
                return Array.isArray(entity.speakerIds) && entity.speakerIds.includes(speakerId);
              return entity.speakerId === speakerId;
            });
      return [
        collection,
        selected.map((entity) =>
          Object.fromEntries(
            keys.filter((key) => entity[key] !== undefined).map((key) => [key, entity[key]])
          )
        )
      ] as const;
    })
  );
  const data = Object.fromEntries(entries);
  if (speakerId !== null && !data.speakers.length) error(404, 'Speaker non trovato.');

  return json(
    {
      schemaVersion: 1,
      workspaceId: 'codemotion-milano-2026',
      readOnly: true,
      cacheTtlSeconds: 300,
      ...data
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
};

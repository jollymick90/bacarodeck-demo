import { beforeEach, expect, it, vi } from 'vitest';

const { data, readCollection } = vi.hoisted(() => {
  const data: Record<string, unknown[]> = {
    speakers: [
      {
        id: 'christian',
        fullName: 'Christian',
        biographyEn: 'Architect',
        createdBy: 'member-1',
        notesMd: 'Internal speaker notes'
      },
      { id: 'olena', fullName: 'Olena' }
    ],
    talks: [
      {
        id: 'joint-talk',
        speakerIds: ['christian', 'olena'],
        title: 'Version control',
        abstractEn: 'A talk',
        updatedBy: 'member-1'
      },
      { id: 'other-talk', speakerIds: ['olena'], title: 'Art' }
    ],
    questions: [
      {
        id: 'q1',
        speakerId: 'christian',
        order: 0,
        textEn: 'Do we need a new version control system?',
        followUpEn: 'Why?',
        status: 'suggested',
        notesMd: 'Min: 3',
        ratings: { 'member-1': 5 },
        createdBy: 'member-1',
        futurePrivateField: 'secret'
      },
      { id: 'q2', speakerId: 'olena', textIt: 'Chi è l’artista?' }
    ],
    interviewPlans: [
      {
        id: 'christian',
        speakerId: 'christian',
        assignedTeamId: 'lorenzo',
        status: 'ready',
        assignedToUid: 'member-1',
        notesMd: 'Internal plan notes'
      }
    ],
    conductorBriefs: [
      {
        id: 'brief-1',
        speakerId: 'christian',
        mainQuestionIds: ['q1'],
        optionalQuestionIds: [],
        classicQuestionIds: []
      }
    ]
  };
  return {
    data,
    readCollection: vi.fn(async (_db: unknown, collection: string) => {
      if (!(collection in data)) throw new Error('Unexpected collection');
      return data[collection];
    })
  };
});

vi.mock('../src/lib/server/firebase-admin', () => ({ getAdmin: () => ({ db: {} }) }));
vi.mock('../src/lib/server/firestore-cache', () => ({ readCollection }));

async function request(query = '') {
  const { GET } = await import('../src/routes/api/public/interviews/+server');
  return GET!({
    url: new URL('https://example.test/api/public/interviews' + query)
  } as never) as Promise<Response>;
}

beforeEach(() => vi.clearAllMocks());

it('lets an unauthenticated reader retrieve current questions and speaker context without changing data', async () => {
  const original = JSON.stringify(data);
  const response = await request();
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.questions).toEqual([
    {
      id: 'q1',
      speakerId: 'christian',
      order: 0,
      textEn: 'Do we need a new version control system?',
      followUpEn: 'Why?',
      status: 'suggested',
      notesMd: 'Min: 3'
    },
    { id: 'q2', speakerId: 'olena', textIt: 'Chi è l’artista?' }
  ]);
  expect(result.speakers).toHaveLength(2);
  expect(result.talks[0].abstractEn).toBe('A talk');
  expect(result.conductorBriefs[0].mainQuestionIds).toEqual(['q1']);
  expect(JSON.stringify(data)).toBe(original);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
});

it('publishes only editorial fields, excluding member IDs, ratings and arbitrary new fields', async () => {
  const response = await request();
  const text = await response.text();
  expect(text).not.toMatch(/member-1|secret|Internal speaker notes|Internal plan notes/);
  const result = JSON.parse(text);
  expect(result.interviewPlans).toEqual([
    { id: 'christian', speakerId: 'christian', assignedTeamId: 'lorenzo', status: 'ready' }
  ]);
});

it('filters every collection by speaker and keeps talks shared with another speaker', async () => {
  const response = await request('?speakerId=christian');
  const result = await response.json();
  expect(result.speakers.map((s: { id: string }) => s.id)).toEqual(['christian']);
  expect(result.talks.map((t: { id: string }) => t.id)).toEqual(['joint-talk']);
  expect(result.questions.map((q: { id: string }) => q.id)).toEqual(['q1']);
  expect(result.interviewPlans).toHaveLength(1);
  expect(result.conductorBriefs).toHaveLength(1);
});

it('rejects malformed speaker IDs before loading data', async () => {
  await expect(request('?speakerId=../members')).rejects.toMatchObject({ status: 400 });
  expect(readCollection).not.toHaveBeenCalled();
});

it('reports an unknown speaker instead of returning an unfiltered workspace', async () => {
  await expect(request('?speakerId=unknown')).rejects.toMatchObject({ status: 404 });
});

it('has no write handler', async () => {
  const route = await import('../src/routes/api/public/interviews/+server');
  expect(Object.keys(route)).not.toEqual(expect.arrayContaining(['POST']));
  expect(
    Object.keys(route).filter((key) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(key))
  ).toEqual([]);
});

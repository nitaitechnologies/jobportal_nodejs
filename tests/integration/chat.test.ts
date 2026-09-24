import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
  expectErrorShape,
} from '../helpers';
import { createPublishedJob, createTestCategory, createTestLocationTree } from '../helpers/fixtures';
import { Candidate } from '../../src/models/Candidate';

describe('Chat & communication', () => {
  it('opens a conversation after employer views application and exchanges messages', async () => {
    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();
    const category = await createTestCategory(admin);
    const { cityId } = await createTestLocationTree(admin);
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Chat Role',
    });

    const candidate = await createAndLoginCandidate();
    const candidateId = candidate.body.data.candidate.id as string;
    await Candidate.findByIdAndUpdate(candidateId, {
      skills: ['nodejs'],
      headline: 'Dev',
    });

    const apply = await api()
      .post(`/api/v1/candidate/jobs/${jobId}/apply`)
      .set(candidate.header)
      .send({});
    expect(apply.status).toBe(201);
    const applicationId = (apply.body.data.application ?? apply.body.data).id as string;

    // Chat locked before view/shortlist
    await expectErrorShape(
      await api()
        .post('/api/v1/candidate/chat/open')
        .set(candidate.header)
        .send({ applicationId }),
      403,
    );

    const view = await api()
      .patch(`/api/v1/employer/applications/${applicationId}/status`)
      .set(employer.header)
      .send({ status: 'viewed' });
    expect(view.status).toBe(200);

    const open = await api()
      .post('/api/v1/employer/chat/open')
      .set(employer.header)
      .send({ applicationId });
    expect(open.status).toBe(200);
    expect(open.body.data.id).toBeTruthy();
    const conversationId = open.body.data.id as string;

    const send = await api()
      .post(`/api/v1/employer/chat/${conversationId}/messages`)
      .set(employer.header)
      .send({ body: 'Hello from HR', type: 'text' });
    expect(send.status).toBe(201);
    expect(send.body.data.body).toBe('Hello from HR');

    const list = await api().get('/api/v1/candidate/chat').set(candidate.header);
    expect(list.status).toBe(200);
    expect(list.body.data.conversations.length).toBeGreaterThan(0);

    const messages = await api()
      .get(`/api/v1/candidate/chat/${conversationId}/messages`)
      .set(candidate.header);
    expect(messages.status).toBe(200);
    expect(messages.body.data.messages.some((m: { body: string }) => m.body === 'Hello from HR')).toBe(
      true,
    );

    const read = await api()
      .post(`/api/v1/candidate/chat/${conversationId}/read`)
      .set(candidate.header);
    expect(read.status).toBe(200);
    expect(read.body.data.unreadCount).toBe(0);

    const contact = await api()
      .get('/api/v1/employer/chat/contact')
      .query({ applicationId })
      .set(employer.header);
    expect(contact.status).toBe(200);
    // viewed is not enough for full reveal (needs shortlist+)
    expect(contact.body.data.contact.revealed).toBe(false);

    const shortlist = await api()
      .patch(`/api/v1/employer/applications/${applicationId}/status`)
      .set(employer.header)
      .send({ status: 'shortlisted' });
    expect(shortlist.status).toBe(200);

    const contact2 = await api()
      .get('/api/v1/employer/chat/contact')
      .query({ applicationId })
      .set(employer.header);
    expect(contact2.status).toBe(200);
    expect(contact2.body.data.contact.revealed).toBe(true);
  });
});

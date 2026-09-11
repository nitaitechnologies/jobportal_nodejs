import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
  createPublishedJob,
  createTestCategory,
  createTestLocationTree,
  expectErrorShape,
} from '../helpers';

describe('Jobs, applications, interviews workflow', () => {
  async function seedMarketplace() {
    const admin = await createAndLoginAdmin();
    const category = await createTestCategory(admin);
    const locations = await createTestLocationTree(admin);
    const employer = await createAndLoginEmployer();
    const { job, jobId, slug } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: locations.cityId,
    });
    const candidate = await createAndLoginCandidate();
    return { admin, category, locations, employer, job, jobId, slug, candidate };
  }

  it('publishes job and lists it in public search', async () => {
    const { slug, job } = await seedMarketplace();
    const list = await api().get('/api/v1/jobs').query({ q: job.title?.split(' ')[0], limit: 20 });
    expect(list.status).toBe(200);
    expect(list.body.success).toBe(true);
    expect(Array.isArray(list.body.data.jobs)).toBe(true);

    const detail = await api().get(`/api/v1/jobs/${slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.job?.slug ?? detail.body.data.slug).toBe(slug);
  });

  it('rejects invalid public job query params', async () => {
    await expectErrorShape(await api().get('/api/v1/jobs').query({ limit: 9999 }), 400);
    await expectErrorShape(await api().get('/api/v1/jobs').query({ sort: 'passwordHash' }), 400);
    await expectErrorShape(await api().get('/api/v1/jobs').query({ page: 0 }), 400);
  });

  it('candidate can save, apply, withdraw; employer updates status', async () => {
    const { candidate, employer, jobId } = await seedMarketplace();

    const save = await api()
      .post(`/api/v1/candidate/saved-jobs/${jobId}`)
      .set(candidate.header);
    expect([200, 201]).toContain(save.status);

    const dupSave = await api()
      .post(`/api/v1/candidate/saved-jobs/${jobId}`)
      .set(candidate.header);
    expect([200, 409]).toContain(dupSave.status);

    const apply = await api()
      .post(`/api/v1/candidate/jobs/${jobId}/apply`)
      .set(candidate.header)
      .send({ coverLetter: 'I am excited to apply for this role at your company.' });
    expect(apply.status).toBe(201);
    const applicationId =
      apply.body.data.application?.id ?? apply.body.data.id;

    const dupApply = await api()
      .post(`/api/v1/candidate/jobs/${jobId}/apply`)
      .set(candidate.header)
      .send({ coverLetter: 'Again' });
    await expectErrorShape(dupApply, 409);

    const employerList = await api()
      .get('/api/v1/employer/applications')
      .set(employer.header);
    expect(employerList.status).toBe(200);
    expect(employerList.body.data.applications.length).toBeGreaterThan(0);
    const raw = JSON.stringify(employerList.body);
    expect(raw).not.toMatch(/media:/);

    const status = await api()
      .patch(`/api/v1/employer/applications/${applicationId}/status`)
      .set(employer.header)
      .send({ status: 'shortlisted' });
    expect(status.status).toBe(200);

    const candApp = await api()
      .get(`/api/v1/candidate/applications/${applicationId}`)
      .set(candidate.header);
    expect(candApp.status).toBe(200);
    expect(
      candApp.body.data.application?.status ?? candApp.body.data.status,
    ).toBe('shortlisted');

    const interview = await api()
      .post('/api/v1/employer/interviews')
      .set(employer.header)
      .send({
        applicationId,
        type: 'online',
        scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 45,
        meetingLink: 'https://meet.example.com/room-1',
        interviewer: 'Hiring Manager',
      });
    expect(interview.status).toBe(201);
    const interviewId = interview.body.data.interview?.id ?? interview.body.data.id;

    const confirm = await api()
      .patch(`/api/v1/candidate/interviews/${interviewId}/confirm`)
      .set(candidate.header);
    expect(confirm.status).toBe(200);

    const notes = await api().get('/api/v1/notifications').set(candidate.header);
    expect(notes.status).toBe(200);
    expect(Array.isArray(notes.body.data.notifications)).toBe(true);
  });

  it('blocks IDOR across employers and candidates', async () => {
    const ctx = await seedMarketplace();
    const otherEmployer = await createAndLoginEmployer({
      companyName: `Other Co ${Date.now()}`,
    });
    const otherCandidate = await createAndLoginCandidate();

    const apply = await api()
      .post(`/api/v1/candidate/jobs/${ctx.jobId}/apply`)
      .set(ctx.candidate.header)
      .send({ coverLetter: 'Cover letter with enough length for validation rules.' });
    expect(apply.status).toBe(201);
    const applicationId = apply.body.data.application?.id ?? apply.body.data.id;

    const stolen = await api()
      .get(`/api/v1/employer/applications/${applicationId}`)
      .set(otherEmployer.header);
    await expectErrorShape(stolen, 404);

    const stolenCand = await api()
      .get(`/api/v1/candidate/applications/${applicationId}`)
      .set(otherCandidate.header);
    await expectErrorShape(stolenCand, 404);
  });
});

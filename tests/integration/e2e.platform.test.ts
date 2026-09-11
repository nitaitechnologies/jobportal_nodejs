import { AnalyticsEvent } from '../../src/models/AnalyticsEvent';
import { Notification } from '../../src/models/Notification';
import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
  createPublishedJob,
  createTestCategory,
  createTestLocationTree,
} from '../helpers';

/**
 * Cross-domain platform flow proving B9–B17 (+ analytics) work together.
 */
describe('E2E platform flow', () => {
  it('admin → taxonomy → employer job → candidate apply → interview → notifications/analytics', async () => {
    const admin = await createAndLoginAdmin();
    const category = await createTestCategory(admin, `Eng ${Date.now()}`);
    const locations = await createTestLocationTree(admin);

    const employer = await createAndLoginEmployer({
      companyName: `Flow Co ${Date.now()}`,
    });
    const { jobId, slug } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: locations.cityId,
      title: `Flow Engineer ${Date.now()}`,
    });

    const candidate = await createAndLoginCandidate();
    await api()
      .patch('/api/v1/candidate/profile')
      .set(candidate.header)
      .send({ headline: 'Full-stack engineer', totalExperience: 3 });

    const search = await api().get('/api/v1/jobs').query({ limit: 50 });
    expect(search.status).toBe(200);
    expect(search.body.data.jobs.some((j: { slug?: string }) => j.slug === slug)).toBe(true);

    await api().post(`/api/v1/candidate/saved-jobs/${jobId}`).set(candidate.header);

    const apply = await api()
      .post(`/api/v1/candidate/jobs/${jobId}/apply`)
      .set(candidate.header)
      .send({ coverLetter: 'Please consider my application for this engineering role.' });
    expect(apply.status).toBe(201);
    const applicationId = apply.body.data.application?.id ?? apply.body.data.id;

    const shortlist = await api()
      .patch(`/api/v1/employer/applications/${applicationId}/status`)
      .set(employer.header)
      .send({ status: 'shortlisted' });
    expect(shortlist.status).toBe(200);

    const interview = await api()
      .post('/api/v1/employer/interviews')
      .set(employer.header)
      .send({
        applicationId,
        type: 'phone',
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 30,
        interviewer: 'Lead',
      });
    expect(interview.status).toBe(201);
    const interviewId = interview.body.data.interview?.id ?? interview.body.data.id;

    await api()
      .patch(`/api/v1/candidate/interviews/${interviewId}/confirm`)
      .set(candidate.header);

    const notifications = await Notification.countDocuments({});
    expect(notifications).toBeGreaterThan(0);

    const events = await AnalyticsEvent.countDocuments({});
    expect(events).toBeGreaterThan(0);

    const analytics = await api()
      .get('/api/v1/admin/analytics/overview')
      .set(admin.header)
      .query({ preset: 'last_30_days' });
    expect(analytics.status).toBe(200);
    expect(analytics.body.success).toBe(true);
  });
});

import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
  createPublishedJob,
  createTestCategory,
  createTestLocationTree,
} from '../helpers';
import { jobAlertService } from '../../src/services/jobAlert.service';

describe('Candidate job alerts (072–082)', () => {
  async function seed() {
    const admin = await createAndLoginAdmin();
    const category = await createTestCategory(admin);
    const locations = await createTestLocationTree(admin);
    const employer = await createAndLoginEmployer();
    const candidate = await createAndLoginCandidate();
    return { admin, category, locations, employer, candidate };
  }

  it('supports saved searches + alert settings + instant alert on publish', async () => {
    const { category, locations, employer, candidate } = await seed();

    const settings = await api()
      .patch('/api/v1/candidate/saved-searches/alert-settings')
      .set(candidate.header)
      .send({
        matchingJobs: true,
        matchScoreMin: 10,
        hotJobs: true,
        governmentJobs: true,
        digestFrequency: 'daily',
      });
    expect(settings.status).toBe(200);
    expect(settings.body.data.settings.matchingJobs).toBe(true);

    const createSearch = await api()
      .post('/api/v1/candidate/saved-searches')
      .set(candidate.header)
      .send({
        name: 'Instant Node roles',
        frequency: 'instant',
        filters: { q: 'Node' },
      });
    expect(createSearch.status).toBe(201);
    const searchId = createSearch.body.data.savedSearch.id as string;

    const list = await api().get('/api/v1/candidate/saved-searches').set(candidate.header);
    expect(list.status).toBe(200);
    expect(list.body.data.savedSearches.length).toBeGreaterThan(0);

    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: locations.cityId,
      title: 'Senior Node.js Engineer',
    });

    // Ensure publish hook + matching ran (also invoke explicitly for determinism).
    await jobAlertService.onJobPublished(jobId);

    const notifications = await api().get('/api/v1/notifications').set(candidate.header);
    expect(notifications.status).toBe(200);
    const types = (notifications.body.data.notifications as Array<{ type: string }>).map(
      (n) => n.type,
    );
    expect(
      types.some((t) =>
        ['JOB_ALERT_INSTANT', 'JOB_MATCH', 'HOT_JOB', 'JOB_NEARBY', 'JOB_SALARY_MATCH'].includes(t),
      ),
    ).toBe(true);

    const patch = await api()
      .patch(`/api/v1/candidate/saved-searches/${searchId}`)
      .set(candidate.header)
      .send({ frequency: 'daily' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.savedSearch.frequency).toBe('daily');

    const del = await api()
      .delete(`/api/v1/candidate/saved-searches/${searchId}`)
      .set(candidate.header);
    expect(del.status).toBe(200);
  });

  it('runs deadline digester for saved jobs', async () => {
    const { category, locations, employer, candidate } = await seed();
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: locations.cityId,
      title: 'Urgent Warehouse Associate',
    });

    // Force a near deadline on the job document.
    const { Job } = await import('../../src/models/Job');
    await Job.updateOne(
      { _id: jobId },
      { applicationDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    );

    const save = await api()
      .post(`/api/v1/candidate/saved-jobs/${jobId}`)
      .set(candidate.header);
    expect([200, 201]).toContain(save.status);

    await api()
      .patch('/api/v1/candidate/saved-searches/alert-settings')
      .set(candidate.header)
      .send({ deadlineAlerts: true, deadlineDays: 5 });

    const result = await jobAlertService.runDeadlineAlerts();
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const notifications = await api().get('/api/v1/notifications').set(candidate.header);
    const types = (notifications.body.data.notifications as Array<{ type: string }>).map(
      (n) => n.type,
    );
    expect(types).toContain('JOB_DEADLINE');
  });
});

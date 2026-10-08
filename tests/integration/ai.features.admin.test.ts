import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
  createPublishedJob,
  createTestCategory,
  createTestLocationTree,
} from '../helpers';
import { AI_FEATURE_CATALOG } from '../../src/constants/aiFeatures';
import { openAiService } from '../../src/services/openai.service';
import { resolveAiEnabled } from '../../src/utils/featureFlags';

describe('Admin AI feature toggles', () => {
  it('turns an AI feature on only when the key, env switch, admin toggle, and master switch allow it', () => {
    const on = { hasOpenAiKey: true, envOn: true, adminOn: true, masterOn: true };
    expect(resolveAiEnabled(on)).toBe(true);
    expect(resolveAiEnabled({ ...on, adminOn: false })).toBe(false);
    expect(resolveAiEnabled({ ...on, masterOn: false })).toBe(false);
    expect(resolveAiEnabled({ ...on, envOn: false })).toBe(false);
    expect(resolveAiEnabled({ ...on, hasOpenAiKey: false })).toBe(false);
  });

  it('sends the same AI flags on candidate, employer, and admin /me, and admin can turn them off', async () => {
    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();
    const candidate = await createAndLoginCandidate();

    const [employerMe, candidateMe, adminMe] = await Promise.all([
      api().get('/api/v1/employer/auth/me').set(employer.header),
      api().get('/api/v1/candidate/auth/me').set(candidate.header),
      api().get('/api/v1/admin/auth/me').set(admin.header),
    ]);
    expect(employerMe.status).toBe(200);
    expect(candidateMe.status).toBe(200);
    expect(adminMe.status).toBe(200);

    for (const item of AI_FEATURE_CATALOG) {
      expect(employerMe.body.data.features).toHaveProperty(item.key, false);
      expect(candidateMe.body.data.features).toHaveProperty(item.key, false);
      expect(adminMe.body.data.features).toHaveProperty(item.key, false);
    }

    const listed = await api().get('/api/v1/admin/ai-features').set(admin.header);
    expect(listed.status).toBe(200);
    expect(listed.body.data.toggles).toHaveLength(AI_FEATURE_CATALOG.length);
    const before = (
      listed.body.data.toggles as Array<{ key: string; adminEnabled: boolean }>
    ).find((row) => row.key === 'aiEmployerMatchingEnabled');
    expect(before?.adminEnabled).toBe(true);

    const updated = await api()
      .patch('/api/v1/admin/ai-features')
      .set(admin.header)
      .send({
        aiEmployerMatchingEnabled: false,
        aiJdImproveEnabled: false,
        aiCandidateScreenEnabled: false,
      });
    expect(updated.status).toBe(200);
    const after = (
      updated.body.data.toggles as Array<{ key: string; adminEnabled: boolean; enabled: boolean }>
    ).find((row) => row.key === 'aiEmployerMatchingEnabled');
    expect(after?.adminEnabled).toBe(false);
    expect(after?.enabled).toBe(false);

    const employerAgain = await api().get('/api/v1/employer/auth/me').set(employer.header);
    expect(employerAgain.body.data.features.aiEmployerMatchingEnabled).toBe(false);
    expect(employerAgain.body.data.features.aiJdImproveEnabled).toBe(false);

    const improve = await api()
      .post('/api/v1/employer/ai/jd/improve')
      .set(employer.header)
      .send({});
    expect(improve.status).toBe(404);

    const candidateMatches = await api()
      .get('/api/v1/candidate/ai/matches')
      .set(candidate.header);
    expect(candidateMatches.status).toBe(404);

    const category = await createTestCategory(admin);
    const locations = await createTestLocationTree(admin);
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: locations.cityId,
      title: 'Node.js Developer',
      skills: ['nodejs'],
    });
    const spy = jest.spyOn(openAiService, 'chatJson');
    const matches = await api()
      .get(`/api/v1/employer/jobs/${jobId}/matches`)
      .query({ withAiInsights: 'true' })
      .set(employer.header);
    expect(matches.status).toBe(200);
    expect(matches.body.data.aiEnabled).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

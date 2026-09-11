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

describe('Taxonomy: categories & locations', () => {
  it('admin creates category; public can list active categories', async () => {
    const admin = await createAndLoginAdmin();
    const category = await createTestCategory(admin, `Sales ${Date.now()}`);

    const list = await api().get('/api/v1/categories');
    expect(list.status).toBe(200);
    expect(list.body.data.categories.some((c: { id: string }) => c.id === category.id)).toBe(
      true,
    );
  });

  it('rejects unauthorized category create', async () => {
    const candidate = await createAndLoginCandidate();
    await expectErrorShape(
      await api()
        .post('/api/v1/admin/categories')
        .set(candidate.header)
        .send({ name: 'Nope', status: 'active' }),
      403,
    );
  });

  it('builds location hierarchy and rejects wrong parent type', async () => {
    const admin = await createAndLoginAdmin();
    const tree = await createTestLocationTree(admin);

    const publicTree = await api().get('/api/v1/locations');
    expect(publicTree.status).toBe(200);

    const badChild = await api()
      .post('/api/v1/admin/locations')
      .set(admin.header)
      .send({
        name: `Bad Area ${Date.now()}`,
        type: 'area',
        parentId: tree.country.id,
        status: 'active',
      });
    await expectErrorShape(badChild, 409);

    const selfParent = await api()
      .patch(`/api/v1/admin/locations/${tree.cityId}`)
      .set(admin.header)
      .send({ parentId: tree.cityId });
    await expectErrorShape(selfParent, 409);
  });
});

describe('Candidate profile', () => {
  it('updates allowed fields and recalculates completion', async () => {
    const candidate = await createAndLoginCandidate();
    const before = await api().get('/api/v1/candidate/profile/completion').set(candidate.header);
    expect(before.status).toBe(200);
    const beforePct = before.body.data.percentage ?? before.body.data.completion?.percentage ?? 0;

    const patch = await api()
      .patch('/api/v1/candidate/profile')
      .set(candidate.header)
      .send({
        headline: 'Backend engineer',
        totalExperience: 4,
        skills: ['nodejs', 'mongodb'],
      });
    expect(patch.status).toBe(200);
    expect(
      patch.body.data.candidate?.headline ??
        patch.body.data.profile?.headline ??
        patch.body.data.headline,
    ).toBe('Backend engineer');

    const after = await api().get('/api/v1/candidate/profile/completion').set(candidate.header);
    expect(after.status).toBe(200);
    const afterPct = after.body.data.percentage ?? after.body.data.completion?.percentage ?? 0;
    expect(afterPct).toBeGreaterThanOrEqual(beforePct);
  });

  it('rejects invalid URL and oversized skills', async () => {
    const candidate = await createAndLoginCandidate();
    await expectErrorShape(
      await api()
        .patch('/api/v1/candidate/profile')
        .set(candidate.header)
        .send({ socialLinks: { linkedin: 'javascript:alert(1)' } }),
      400,
    );
    await expectErrorShape(
      await api()
        .patch('/api/v1/candidate/profile')
        .set(candidate.header)
        .send({ skills: Array.from({ length: 200 }, (_, i) => `skill-${i}`) }),
      400,
    );
  });
});

describe('Subscriptions & admin oversight smoke', () => {
  it('lists public plans and employer entitlements', async () => {
    const admin = await createAndLoginAdmin();
    const slug = `starter-${Date.now()}`;
    const plan = await api()
      .post('/api/v1/admin/subscription-plans')
      .set(admin.header)
      .send({
        name: 'Starter',
        slug,
        price: 0,
        currency: 'INR',
        billingCycle: 'monthly',
        features: { featuredJobs: false, candidateContact: false },
        limits: { jobPostLimit: 3, activeJobLimit: 3, featuredJobLimit: 0 },
        status: 'active',
      });
    expect(plan.status).toBe(201);

    const publicPlans = await api().get('/api/v1/subscription-plans');
    expect(publicPlans.status).toBe(200);

    const employer = await createAndLoginEmployer();
    const current = await api().get('/api/v1/employer/subscription').set(employer.header);
    expect(current.status).toBe(200);

    const entitlements = await api()
      .get('/api/v1/employer/subscription/entitlements')
      .set(employer.header);
    expect(entitlements.status).toBe(200);
  });

  it('admin can list candidates and employers', async () => {
    await createAndLoginCandidate();
    await createAndLoginEmployer();
    const admin = await createAndLoginAdmin();

    const candidates = await api().get('/api/v1/admin/candidates').set(admin.header);
    expect(candidates.status).toBe(200);
    expect(Array.isArray(candidates.body.data.candidates)).toBe(true);

    const employers = await api().get('/api/v1/admin/employers').set(admin.header);
    expect(employers.status).toBe(200);
    expect(Array.isArray(employers.body.data.employers)).toBe(true);
  });
});

describe('Career advice & reports', () => {
  it('admin publishes article; public can read it', async () => {
    const admin = await createAndLoginAdmin();
    const create = await api()
      .post('/api/v1/admin/career-advice')
      .set(admin.header)
      .send({
        title: `How to interview ${Date.now()}`,
        excerpt: 'Tips for candidates preparing for technical interviews.',
        content:
          'Prepare stories, practice coding problems, and research the company thoroughly before the interview.',
        category: 'interview',
        tags: ['interview', 'tips'],
      });
    expect(create.status).toBe(201);
    const articleId = create.body.data.article?.id ?? create.body.data.id;

    const publish = await api()
      .patch(`/api/v1/admin/career-advice/${articleId}/publish`)
      .set(admin.header);
    expect(publish.status).toBe(200);
    const slug = publish.body.data.article?.slug ?? publish.body.data.slug;

    const detail = await api().get(`/api/v1/career-advice/${slug}`);
    expect(detail.status).toBe(200);
  });

  it('candidate can create a report and cannot see others', async () => {
    const admin = await createAndLoginAdmin();
    const category = await createTestCategory(admin);
    const locations = await createTestLocationTree(admin);
    const employer = await createAndLoginEmployer();
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: locations.cityId,
    });

    const reporter = await createAndLoginCandidate();
    const other = await createAndLoginCandidate();

    const report = await api()
      .post('/api/v1/reports')
      .set(reporter.header)
      .send({
        targetType: 'job',
        targetId: jobId,
        reason: 'spam',
        description: 'This listing looks like spam or a duplicate posting.',
      });
    expect(report.status).toBe(201);
    const reportId = report.body.data.report?.id ?? report.body.data.id;

    const mine = await api().get('/api/v1/reports/my').set(reporter.header);
    expect(mine.status).toBe(200);

    await expectErrorShape(
      await api().get(`/api/v1/reports/my/${reportId}`).set(other.header),
      404,
    );
  });
});

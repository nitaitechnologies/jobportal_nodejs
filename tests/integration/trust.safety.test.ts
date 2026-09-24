import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
} from '../helpers';
import { createPublishedJob, createTestCategory, createTestLocationTree } from '../helpers/fixtures';
import { Company } from '../../src/models/Company';
import { computeJobSafetyHints } from '../../src/utils/jobSafety';

describe('Trust & safety (141-148)', () => {
  it('exposes verified + safetyHints, supports block, report, and verification', async () => {
    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();
    const category = await createTestCategory(admin);
    const { cityId } = await createTestLocationTree(admin);

    const owned = await api().get('/api/v1/employer/company').set(employer.header);
    expect(owned.status).toBe(200);
    const companyId = owned.body.data.company.id as string;
    await Company.findByIdAndUpdate(companyId, { verificationStatus: 'verified' });

    const { jobId, slug } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Safe Role',
      description: 'Build products. No fees. Apply on platform only.',
    });

    const detail = await api().get(`/api/v1/jobs/${slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.job.company.verified).toBe(true);
    expect(detail.body.data.job.safetyHints).toBeTruthy();
    expect(detail.body.data.job.safetyHints.level).toBe('none');

    const scamHints = computeJobSafetyHints({
      title: 'Easy cash',
      description: 'Pay registration fee via UPI and share OTP to join.',
      companyVerificationStatus: 'unverified',
      salaryMax: 500000,
      salaryPeriod: 'monthly',
    });
    expect(scamHints.suspectedFake).toBe(true);
    expect(scamHints.level).toBe('high');
    expect(scamHints.codes.length).toBeGreaterThan(0);

    const candidate = await createAndLoginCandidate();

    const report = await api()
      .post('/api/v1/reports')
      .set(candidate.header)
      .send({
        targetType: 'job',
        targetId: jobId,
        reason: 'fraud',
        description: 'Looks like a scam posting asking for money.',
      });
    expect([201, 200]).toContain(report.status);

    const block = await api()
      .post('/api/v1/candidate/safety/block-employer')
      .set(candidate.header)
      .send({ companyId, reason: 'Harassment' });
    expect(block.status).toBe(200);
    expect(block.body.data.blocked).toBe(true);

    const applyBlocked = await api()
      .post(`/api/v1/candidate/jobs/${jobId}/apply`)
      .set(candidate.header)
      .send({});
    expect(applyBlocked.status).toBe(403);

    const listed = await api()
      .get('/api/v1/candidate/safety/blocked-employers')
      .set(candidate.header);
    expect(listed.status).toBe(200);
    expect(listed.body.data.blocked.length).toBeGreaterThanOrEqual(1);

    await api()
      .post('/api/v1/candidate/safety/unblock-employer')
      .set(candidate.header)
      .send({ companyId })
      .expect(200);

    const doc = await api()
      .post('/api/v1/candidate/safety/verification/documents')
      .set(candidate.header)
      .send({
        type: 'aadhaar',
        mediaUrl: 'https://cdn.example.com/id.pdf',
      });
    expect(doc.status).toBe(201);
    expect(doc.body.data.verificationStatus).toBe('pending');

    const status = await api()
      .get('/api/v1/candidate/safety/verification')
      .set(candidate.header);
    expect(status.status).toBe(200);
    expect(status.body.data.documents.length).toBeGreaterThanOrEqual(1);

    const profile = await api().get('/api/v1/candidate/profile').set(candidate.header);
    expect(profile.status).toBe(200);
    expect(profile.body.data.trust).toBeTruthy();
    expect(typeof profile.body.data.trust.verifiedBadge).toBe('boolean');
  });
});

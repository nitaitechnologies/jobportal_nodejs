import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
} from '../helpers';
import { createPublishedJob, createTestCategory, createTestLocationTree } from '../helpers/fixtures';

describe('Fresher Mode (149-156)', () => {
  async function seed() {
    const admin = await createAndLoginAdmin();
    const category = await createTestCategory(admin);
    const { cityId } = await createTestLocationTree(admin);
    return { admin, category, cityId };
  }

  it('supports fresherMode presets and candidate isFresher option', async () => {
    const { category, cityId } = await seed();

    const employerA = await createAndLoginEmployer();
    const employerB = await createAndLoginEmployer();
    const employerC = await createAndLoginEmployer();
    const employerD = await createAndLoginEmployer();

    await createPublishedJob(employerA, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Fresher Sales Executive',
      experience: { min: 0, max: 0 },
      education: '12th Pass',
    });
    await createPublishedJob(employerB, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Marketing Intern',
      employmentType: 'internship',
      experience: { min: 0, max: 1 },
      education: 'Any Graduate',
    });
    await createPublishedJob(employerC, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Trainee Data Entry Operator',
      experience: { min: 0, max: 0 },
      education: '10th Pass',
      description: 'On-the-job training provided for freshers.',
    });
    await createPublishedJob(employerD, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Senior Engineer',
      experience: { min: 5, max: 8 },
      education: 'B.Tech / B.E.',
    });

    const fresher = await api().get('/api/v1/jobs').query({ fresherMode: 'fresher', limit: 50 });
    expect(fresher.status).toBe(200);
    expect(fresher.body.success).toBe(true);
    const fresherTitles = (fresher.body.data.jobs as Array<{ title: string }>).map((j) => j.title);
    expect(fresherTitles.some((t) => /Fresher Sales|Intern|Trainee/i.test(t))).toBe(true);
    expect(fresherTitles.every((t) => !/Senior Engineer/i.test(t))).toBe(true);

    const noExp = await api()
      .get('/api/v1/jobs')
      .query({ fresherMode: 'no-experience', limit: 50 });
    expect(noExp.status).toBe(200);
    expect(Array.isArray(noExp.body.data.jobs)).toBe(true);

    const internships = await api()
      .get('/api/v1/jobs')
      .query({ fresherMode: 'internship', limit: 50 });
    expect(internships.status).toBe(200);
    expect(
      (internships.body.data.jobs as Array<{ employmentType?: string; title: string }>).some(
        (j) => j.employmentType === 'internship' || /Intern/i.test(j.title),
      ),
    ).toBe(true);

    const training = await api()
      .get('/api/v1/jobs')
      .query({ fresherMode: 'training', limit: 50 });
    expect(training.status).toBe(200);
    expect(
      (training.body.data.jobs as Array<{ title: string }>).some((j) => /Trainee/i.test(j.title)),
    ).toBe(true);

    const graduate = await api()
      .get('/api/v1/jobs')
      .query({ fresherMode: 'graduate', limit: 50 });
    expect(graduate.status).toBe(200);

    const tenth = await api().get('/api/v1/jobs').query({ fresherMode: '10th', limit: 50 });
    expect(tenth.status).toBe(200);
    expect(
      (tenth.body.data.jobs as Array<{ education?: string }>).some((j) =>
        /10th/i.test(j.education ?? ''),
      ),
    ).toBe(true);

    const twelfth = await api().get('/api/v1/jobs').query({ fresherMode: '12th', limit: 50 });
    expect(twelfth.status).toBe(200);

    const entry = await api()
      .get('/api/v1/jobs')
      .query({ fresherMode: 'entry-level', limit: 50 });
    expect(entry.status).toBe(200);

    const bad = await api().get('/api/v1/jobs').query({ fresherMode: 'magic' });
    expect(bad.status).toBe(400);

    const candidate = await createAndLoginCandidate();
    const asFresher = await api()
      .patch('/api/v1/candidate/profile')
      .set(candidate.header)
      .send({
        isFresher: true,
        headline: 'Fresher looking for first role',
        education: [
          {
            degree: '12th',
            institution: 'Delhi Public School',
            endYear: 2024,
          },
        ],
      });
    expect(asFresher.status).toBe(200);
    expect(asFresher.body.data.profile.isFresher).toBe(true);
    expect(asFresher.body.data.profile.workExperience ?? []).toHaveLength(0);
    expect(asFresher.body.data.profile.totalExperience).toBe(0);

    const me = await api().get('/api/v1/candidate/profile').set(candidate.header);
    expect(me.status).toBe(200);
    expect(me.body.data.profile.isFresher).toBe(true);
  });
});

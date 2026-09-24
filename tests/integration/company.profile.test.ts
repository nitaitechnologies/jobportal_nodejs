import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
} from '../helpers';
import { createPublishedJob, createTestCategory, createTestLocationTree } from '../helpers/fixtures';
import { Company } from '../../src/models/Company';

describe('Public company profile (133-140)', () => {
  it('returns name/logo/about/size/verified/benefits/gallery/jobs/reviews', async () => {
    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();
    const category = await createTestCategory(admin);
    const { cityId } = await createTestLocationTree(admin);
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Company Profile Role',
    });
    expect(jobId).toBeTruthy();

    const owned = await api().get('/api/v1/employer/company').set(employer.header);
    expect(owned.status).toBe(200);
    const companyId = owned.body.data.company.id as string;
    const slug = owned.body.data.company.slug as string;

    const patch = await api()
      .patch('/api/v1/employer/company')
      .set(employer.header)
      .send({
        description: 'We build products for India.',
        industry: 'IT Services',
        companySize: '51-200',
        headquarters: 'Bengaluru',
        locations: ['Bengaluru', 'Pune'],
        benefits: ['Health insurance', 'Learning budget'],
        gallery: [
          {
            url: 'https://cdn.example.com/office.jpg',
            type: 'image',
            caption: 'Office',
          },
        ],
        logo: 'https://cdn.example.com/logo.png',
      });
    expect(patch.status).toBe(200);
    expect(patch.body.data.company.benefits).toContain('Health insurance');
    expect(patch.body.data.company.gallery.length).toBe(1);

    await Company.findByIdAndUpdate(companyId, { verificationStatus: 'verified' });

    const publicProfile = await api().get(`/api/v1/companies/${slug}`);
    expect(publicProfile.status).toBe(200);
    const company = publicProfile.body.data.company;
    expect(company.name).toBeTruthy();
    expect(company.logo).toContain('https://');
    expect(company.description).toContain('India');
    expect(company.industry).toBe('IT Services');
    expect(company.companySize).toBe('51-200');
    expect(company.headquarters).toBe('Bengaluru');
    expect(company.locations).toContain('Bengaluru');
    expect(company.verified).toBe(true);
    expect(company.verificationStatus).toBe('verified');
    expect(company.benefits).toEqual(expect.arrayContaining(['Health insurance']));
    expect(company.gallery[0].url).toContain('https://');
    expect(company.openJobsCount).toBeGreaterThanOrEqual(1);

    const socialPatch = await api()
      .patch('/api/v1/employer/company')
      .set(employer.header)
      .send({
        socialLinks: {
          linkedin: 'https://www.linkedin.com/company/example',
          twitter: 'https://twitter.com/example',
        },
        gallery: [
          {
            url: 'https://cdn.example.com/office.jpg',
            type: 'image',
            caption: 'Office',
          },
          {
            url: '/api/v1/media/public/507f1f77bcf86cd799439011',
            type: 'image',
            caption: 'Team',
          },
        ],
      });
    expect(socialPatch.status).toBe(200);
    expect(socialPatch.body.data.company.socialLinks.linkedin).toContain('linkedin.com');
    expect(socialPatch.body.data.company.gallery).toHaveLength(2);

    const publicAfterSocial = await api().get(`/api/v1/companies/${slug}`);
    expect(publicAfterSocial.status).toBe(200);
    expect(publicAfterSocial.body.data.company.socialLinks.linkedin).toContain('linkedin.com');

    const jobs = await api().get(`/api/v1/companies/${slug}/jobs`);
    expect(jobs.status).toBe(200);
    expect(jobs.body.data.jobs.length).toBeGreaterThanOrEqual(1);

    const candidate = await createAndLoginCandidate();
    const review = await api()
      .post(`/api/v1/companies/${slug}/reviews`)
      .set(candidate.header)
      .send({
        rating: 5,
        title: 'Solid team',
        body: 'Great place to grow your career in product engineering.',
      });
    expect(review.status).toBe(201);
    expect(review.body.data.review.rating).toBe(5);

    const list = await api().get(`/api/v1/companies/${slug}/reviews`);
    expect(list.status).toBe(200);
    expect(list.body.data.reviews.length).toBeGreaterThanOrEqual(1);
    expect(list.body.data.summary.ratingCount).toBeGreaterThanOrEqual(1);
    expect(list.body.data.summary.ratingAvg).toBeGreaterThan(0);

    const after = await api().get(`/api/v1/companies/${slug}`);
    expect(after.body.data.company.ratingCount).toBeGreaterThanOrEqual(1);
  });
});

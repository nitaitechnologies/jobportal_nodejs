import { api } from './http';
import type { createAndLoginAdmin, createAndLoginEmployer } from './auth';

type AdminSession = Awaited<ReturnType<typeof createAndLoginAdmin>>;
type EmployerSession = Awaited<ReturnType<typeof createAndLoginEmployer>>;

export async function createTestCategory(admin: AdminSession, name?: string) {
  const res = await api()
    .post('/api/v1/admin/categories')
    .set(admin.header)
    .send({
      name: name ?? `Category ${Date.now()}`,
      description: 'Test category',
      status: 'active',
    });
  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  return res.body.data.category ?? res.body.data;
}

export async function createTestLocationTree(admin: AdminSession) {
  const country = await api()
    .post('/api/v1/admin/locations')
    .set(admin.header)
    .send({ name: `India ${Date.now()}`, type: 'country', countryCode: 'IN', status: 'active' });
  expect(country.status).toBe(201);
  const countryId = (country.body.data.location ?? country.body.data).id;

  const state = await api()
    .post('/api/v1/admin/locations')
    .set(admin.header)
    .send({
      name: `Maharashtra ${Date.now()}`,
      type: 'state',
      parentId: countryId,
      status: 'active',
    });
  expect(state.status).toBe(201);
  const stateId = (state.body.data.location ?? state.body.data).id;

  const city = await api()
    .post('/api/v1/admin/locations')
    .set(admin.header)
    .send({
      name: `Mumbai ${Date.now()}`,
      type: 'city',
      parentId: stateId,
      status: 'active',
    });
  expect(city.status).toBe(201);
  const cityDoc = city.body.data.location ?? city.body.data;

  return {
    country: country.body.data.location ?? country.body.data,
    state: state.body.data.location ?? state.body.data,
    city: cityDoc,
    cityId: cityDoc.id as string,
  };
}

export async function createPublishedJob(
  employer: EmployerSession,
  opts: { categoryId: string; locationId: string; title?: string },
) {
  const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const create = await api()
    .post('/api/v1/employer/jobs')
    .set(employer.header)
    .send({
      title: opts.title ?? `Node Developer ${Date.now()}`,
      description: 'We are hiring an experienced Node.js developer for our platform team.',
      workMode: 'remote',
      employmentType: 'full-time',
      categoryId: opts.categoryId,
      locationId: opts.locationId,
      experience: { min: 1, max: 5 },
      salary: { min: 500000, max: 1200000, period: 'yearly' },
      deadline,
      skills: ['nodejs', 'typescript'],
    });
  expect(create.status).toBe(201);
  const job = create.body.data.job ?? create.body.data;
  const jobId = job.id as string;

  const publish = await api()
    .patch(`/api/v1/employer/jobs/${jobId}/publish`)
    .set(employer.header);
  expect(publish.status).toBe(200);
  const published = publish.body.data.job ?? publish.body.data;

  return { job: published, jobId, slug: published.slug as string };
}

import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
  createPublishedJob,
  createTestCategory,
  createTestLocationTree,
  uniqueEmail,
  uniquePhone,
} from '../helpers';
import * as emailService from '../../src/services/email.service';
import { walletService } from '../../src/services/wallet.service';

describe('Client hiring ops: boost notify, apply email, staff departments', () => {
  async function seedJob() {
    const admin = await createAndLoginAdmin();
    const category = await createTestCategory(admin);
    const locations = await createTestLocationTree(admin);
    const employer = await createAndLoginEmployer();
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: locations.cityId,
      title: 'Node.js Developer',
      skills: ['nodejs', 'typescript'],
    });
    return { employer, jobId, category, locations };
  }

  it('adds staff with a department and assigns a job post to them', async () => {
    const { employer, jobId } = await seedJob();
    const staffEmail = uniqueEmail('aman');

    const invite = await api()
      .post('/api/v1/employer/team/invite')
      .set(employer.header)
      .send({
        email: staffEmail,
        name: 'Aman',
        teamRole: 'recruiter',
        department: 'Development',
      });
    expect(invite.status).toBe(201);
    expect(invite.body.data.invite.department).toBe('Development');

    const accept = await api().post('/api/v1/employer/auth/team/accept').send({
      token: invite.body.data.invite.token,
      name: 'Aman',
      phone: uniquePhone(),
      password: 'Password1',
    });
    expect(accept.status).toBe(201);
    expect(accept.body.data.employer.department).toBe('Development');
    const staffId = accept.body.data.employer.id as string;

    const team = await api().get('/api/v1/employer/team').set(employer.header);
    expect(team.status).toBe(200);
    const aman = (team.body.data.members as Array<{ id: string; department: string }>).find(
      (member) => member.id === staffId,
    );
    expect(aman?.department).toBe('Development');

    const department = await api()
      .patch(`/api/v1/employer/team/${staffId}/department`)
      .set(employer.header)
      .send({ department: 'Engineering' });
    expect(department.status).toBe(200);
    expect(department.body.data.member.department).toBe('Engineering');

    const assign = await api()
      .patch(`/api/v1/employer/jobs/${jobId}/assignees`)
      .set(employer.header)
      .send({ employerIds: [staffId] });
    expect(assign.status).toBe(200);
    expect(assign.body.data.job.assignedEmployerIds).toContain(staffId);
    expect(
      (assign.body.data.job.assignees as Array<{ id: string; name: string }>).some(
        (row) => row.id === staffId && row.name === 'Aman',
      ),
    ).toBe(true);
  });

  it('notifies matching candidates in the app when a job is boosted', async () => {
    const { employer, jobId } = await seedJob();
    const candidate = await createAndLoginCandidate({ name: 'Matching Candidate' });

    const profile = await api()
      .patch('/api/v1/candidate/profile')
      .set(candidate.header)
      .send({
        skills: ['nodejs', 'typescript'],
        totalExperience: 3,
        expectedSalary: 800000,
        openToWork: true,
        profileVisibility: 'public',
        headline: 'Node.js Developer',
      });
    expect(profile.status).toBe(200);

    const companyId = employer.body.data.company.id as string;
    await walletService.credit({
      companyId,
      credits: 100,
      type: 'adjustment',
      description: 'Test boost credits',
    });

    const boost = await api()
      .patch(`/api/v1/employer/jobs/${jobId}/feature`)
      .set(employer.header)
      .send({ featured: true });
    expect(boost.status).toBe(200);
    expect(boost.body.data.job?.featured ?? boost.body.data.featured).toBe(true);

    const notifications = await api().get('/api/v1/notifications').set(candidate.header);
    expect(notifications.status).toBe(200);
    const boostNote = (
      notifications.body.data.notifications as Array<{
        type: string;
        title: string;
        data?: { boost?: boolean };
      }>
    ).find((row) => row.type === 'HOT_JOB' && row.data?.boost === true);
    expect(boostNote?.title).toBe('Boosted job match');
  });

  it('emails the company when a candidate applies', async () => {
    const { employer, jobId } = await seedJob();
    const contactEmail = uniqueEmail('hiring');
    const company = await api()
      .patch('/api/v1/employer/company')
      .set(employer.header)
      .send({ contactEmail });
    expect(company.status).toBe(200);

    const candidate = await createAndLoginCandidate({ name: 'Riya Sharma' });
    const spy = jest.spyOn(emailService, 'sendEmail');

    const apply = await api()
      .post(`/api/v1/candidate/jobs/${jobId}/apply`)
      .set(candidate.header)
      .send({});
    expect(apply.status).toBe(201);

    const sentTo = spy.mock.calls.map((call) => call[0].to.toLowerCase());
    expect(sentTo).toContain(contactEmail.toLowerCase());
    expect(sentTo).toContain(employer.payload.email.toLowerCase());

    const employerNotes = await api().get('/api/v1/notifications').set(employer.header);
    const types = (employerNotes.body.data.notifications as Array<{ type: string }>).map(
      (row) => row.type,
    );
    expect(types).toContain('APPLICATION_SUBMITTED');

    spy.mockRestore();
  });
});

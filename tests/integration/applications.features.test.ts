import {
  api,
  createAndLoginCandidate,
  createAndLoginEmployer,
  createPublishedJob,
  createTestCategory,
  createTestLocationTree,
  createAndLoginAdmin,
  expectErrorShape,
} from '../helpers';

describe('Candidate applications features (064–071)', () => {
  async function seed() {
    const admin = await createAndLoginAdmin();
    const category = await createTestCategory(admin);
    const locations = await createTestLocationTree(admin);
    const employer = await createAndLoginEmployer();
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: locations.cityId,
    });
    const candidate = await createAndLoginCandidate();
    return { employer, candidate, jobId };
  }

  it('supports one-tap apply with confirmation + history + status timestamps', async () => {
    const { candidate, employer, jobId } = await seed();

    const apply = await api()
      .post(`/api/v1/candidate/jobs/${jobId}/apply`)
      .set(candidate.header)
      .send({});
    expect(apply.status).toBe(201);
    expect(apply.body.data.confirmation?.status).toBe('applied');
    expect(apply.body.data.application?.status).toBe('applied');
    const applicationId = apply.body.data.application.id as string;

    const resumes = await api().get('/api/v1/candidate/profile/resumes').set(candidate.header);
    expect(resumes.status).toBe(200);
    expect(Array.isArray(resumes.body.data.resumes)).toBe(true);

    const history = await api().get('/api/v1/candidate/applications').set(candidate.header);
    expect(history.status).toBe(200);
    expect(history.body.data.applications.length).toBeGreaterThan(0);

    const detail = await api()
      .get(`/api/v1/candidate/applications/${applicationId}`)
      .set(candidate.header);
    expect(detail.status).toBe(200);
    expect(detail.body.data.application).toHaveProperty('viewedAt');
    expect(detail.body.data.application).toHaveProperty('shortlistedAt');

    const employerView = await api()
      .get(`/api/v1/employer/applications/${applicationId}`)
      .set(employer.header);
    expect(employerView.status).toBe(200);
    expect(employerView.body.data.application.status).toBe('viewed');

    const notifications = await api().get('/api/v1/notifications').set(candidate.header);
    expect(notifications.status).toBe(200);
    const types = (notifications.body.data.notifications as Array<{ type: string }>).map(
      (n) => n.type,
    );
    expect(types).toContain('APPLICATION_CONFIRMATION');
    expect(types).toContain('RECRUITER_VIEWED_PROFILE');
  });

  it('supports recruiter invitation + accept (apply) + decline path', async () => {
    const { employer, candidate, jobId } = await seed();
    const other = await createAndLoginCandidate();

    const profile = await api().get('/api/v1/candidate/profile').set(candidate.header);
    expect(profile.status).toBe(200);
    const candidateId =
      profile.body.data.candidate?.id ?? profile.body.data.profile?.id ?? profile.body.data.id;

    // Make candidate discoverable for invite flow
    await api()
      .patch('/api/v1/candidate/profile')
      .set(candidate.header)
      .send({ profileVisibility: 'employers_only', headline: 'Open to work' });

    const invite = await api()
      .post('/api/v1/employer/invitations')
      .set(employer.header)
      .send({ candidateId, jobId, message: 'We liked your profile' });
    expect(invite.status).toBe(201);
    const invitationId = invite.body.data.invitation.id as string;

    const candidateNotifs = await api().get('/api/v1/notifications').set(candidate.header);
    const inviteTypes = (
      candidateNotifs.body.data.notifications as Array<{ type: string }>
    ).map((n) => n.type);
    expect(inviteTypes).toContain('RECRUITER_INVITATION');

    const accept = await api()
      .patch(`/api/v1/candidate/invitations/${invitationId}/accept`)
      .set(candidate.header);
    expect(accept.status).toBe(200);
    expect(accept.body.data.invitation.status).toBe('accepted');
    expect(accept.body.data.application?.status).toBe('applied');

    // Second candidate: invite then decline
    const otherProfile = await api().get('/api/v1/candidate/profile').set(other.header);
    const otherId =
      otherProfile.body.data.candidate?.id ??
      otherProfile.body.data.profile?.id ??
      otherProfile.body.data.id;
    await api()
      .patch('/api/v1/candidate/profile')
      .set(other.header)
      .send({ profileVisibility: 'public', headline: 'Looking' });

    const invite2 = await api()
      .post('/api/v1/employer/invitations')
      .set(employer.header)
      .send({ candidateId: otherId, jobId });
    expect(invite2.status).toBe(201);
    const invitation2Id = invite2.body.data.invitation.id as string;

    const decline = await api()
      .patch(`/api/v1/candidate/invitations/${invitation2Id}/decline`)
      .set(other.header);
    expect(decline.status).toBe(200);
    expect(decline.body.data.invitation.status).toBe('declined');

    await expectErrorShape(
      await api()
        .patch(`/api/v1/candidate/invitations/${invitation2Id}/accept`)
        .set(other.header),
      409,
    );
  });
});

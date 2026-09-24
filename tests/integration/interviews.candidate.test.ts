import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
} from '../helpers';
import { createPublishedJob, createTestCategory, createTestLocationTree } from '../helpers/fixtures';
import { Interview } from '../../src/models/Interview';
import { Notification } from '../../src/models/Notification';
import { interviewReminderService } from '../../src/services/interviewReminder.service';

describe('Candidate interviews (124-132)', () => {
  it('covers upcoming list, location/link, accept, reschedule, decline, reminders, status', async () => {
    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();
    const category = await createTestCategory(admin);
    const { cityId } = await createTestLocationTree(admin);
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Interview Backend Role',
    });

    const candidate = await createAndLoginCandidate();

    const apply = await api()
      .post(`/api/v1/candidate/jobs/${jobId}/apply`)
      .set(candidate.header)
      .send({});
    expect(apply.status).toBe(201);
    const applicationId = (apply.body.data.application ?? apply.body.data).id as string;

    await api()
      .patch(`/api/v1/employer/applications/${applicationId}/status`)
      .set(employer.header)
      .send({ status: 'shortlisted' })
      .expect(200);

    const create = await api()
      .post('/api/v1/employer/interviews')
      .set(employer.header)
      .send({
        applicationId,
        type: 'online',
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 45,
        meetingLink: 'https://meet.example.com/room-1',
        location: 'Remote',
        interviewer: 'Hiring Manager',
      });
    expect(create.status).toBe(201);
    const interviewId = create.body.data.interview.id as string;
    expect(create.body.data.interview.meetingLink).toContain('https://');
    expect(create.body.data.interview.location).toBe('Remote');
    expect(create.body.data.interview.status).toBe('scheduled');

    const upcoming = await api()
      .get('/api/v1/candidate/interviews')
      .query({ upcoming: 'true' })
      .set(candidate.header);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.data.interviews.some((row: { id: string }) => row.id === interviewId)).toBe(
      true,
    );

    const detail = await api()
      .get(`/api/v1/candidate/interviews/${interviewId}`)
      .set(candidate.header);
    expect(detail.status).toBe(200);
    expect(detail.body.data.interview.job?.title).toBeTruthy();
    expect(detail.body.data.interview.company?.name).toBeTruthy();
    expect(detail.body.data.interview.meetingLink).toContain('https://');
    expect(detail.body.data.interview.location).toBe('Remote');

    const confirm = await api()
      .patch(`/api/v1/candidate/interviews/${interviewId}/confirm`)
      .set(candidate.header);
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.interview.status).toBe('confirmed');

    const newTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const reschedule = await api()
      .patch(`/api/v1/candidate/interviews/${interviewId}/reschedule`)
      .set(candidate.header)
      .send({ scheduledAt: newTime, notes: 'Prefer afternoon' });
    expect(reschedule.status).toBe(200);
    expect(reschedule.body.data.interview.status).toBe('rescheduled');
    expect(reschedule.body.data.interview.notes).toContain('Prefer afternoon');

    // 24h reminder window
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await Interview.findByIdAndUpdate(interviewId, {
      scheduledAt: in24h,
      reminder24hSentAt: null,
      reminder1hSentAt: null,
      status: 'rescheduled',
    });

    const pass = await interviewReminderService.runReminderPass();
    expect(pass.sent24h).toBeGreaterThanOrEqual(1);

    const reminder = await Notification.findOne({
      type: 'INTERVIEW_REMINDER_24H',
      'data.interviewId': interviewId,
    });
    expect(reminder).toBeTruthy();

    const again = await interviewReminderService.runReminderPass();
    expect(again.sent24h).toBe(0);

    // 1h reminder
    const in1h = new Date(Date.now() + 60 * 60 * 1000);
    await Interview.findByIdAndUpdate(interviewId, {
      scheduledAt: in1h,
      reminder1hSentAt: null,
      status: 'rescheduled',
    });
    const pass1h = await interviewReminderService.runReminderPass();
    expect(pass1h.sent1h).toBeGreaterThanOrEqual(1);

    const decline = await api()
      .patch(`/api/v1/candidate/interviews/${interviewId}/decline`)
      .set(candidate.header)
      .send({ cancellationReason: 'Conflict' });
    expect(decline.status).toBe(200);
    expect(decline.body.data.interview.status).toBe('declined');
  });
});

/**
 * Remove superseded D1 demo accounts that D2 persona emails replaced,
 * plus out-of-range numbered candidates. Cascades related profile rows only.
 */
import { AdminUser } from '../../models/AdminUser';
import { Application } from '../../models/Application';
import { Candidate } from '../../models/Candidate';
import { Employer } from '../../models/Employer';
import { Interview } from '../../models/Interview';
import { MediaFile } from '../../models/MediaFile';
import { Notification } from '../../models/Notification';
import { Report } from '../../models/Report';
import { SavedJob } from '../../models/SavedJob';
import { Subscription } from '../../models/Subscription';
import { User } from '../../models/User';
import { demoEmail } from '../config';

export async function pruneSupersededDemoAccounts(): Promise<number> {
  const superseded = [
    demoEmail('employer.001'),
    demoEmail('employer.002'),
    demoEmail('employer.003'),
    demoEmail('candidate.038'),
    demoEmail('candidate.039'),
    demoEmail('candidate.040'),
  ];

  const users = await User.find({ email: { $in: superseded } }).select('_id role');
  if (users.length === 0) return 0;

  const userIds = users.map((u) => u._id);
  const candidateUsers = users.filter((u) => u.role === 'candidate').map((u) => u._id);
  const employerUsers = users.filter((u) => u.role === 'employer').map((u) => u._id);

  const candidates = await Candidate.find({ userId: { $in: candidateUsers } }).select('_id');
  const candidateIds = candidates.map((c) => c._id);
  const employers = await Employer.find({ userId: { $in: employerUsers } }).select('_id companyId');
  const employerIds = employers.map((e) => e._id);

  await Promise.all([
    Notification.deleteMany({ recipientId: { $in: userIds } }),
    Report.deleteMany({ reporterId: { $in: userIds } }),
    MediaFile.deleteMany({ ownerUserId: { $in: userIds } }),
    SavedJob.deleteMany({ candidateId: { $in: candidateIds } }),
    Interview.deleteMany({
      $or: [{ candidateId: { $in: candidateIds } }, { employerId: { $in: employerIds } }],
    }),
    Application.deleteMany({
      $or: [{ candidateId: { $in: candidateIds } }, { employerId: { $in: employerIds } }],
    }),
    Subscription.deleteMany({ userId: { $in: employerUsers } }),
    Candidate.deleteMany({ _id: { $in: candidateIds } }),
    Employer.deleteMany({ _id: { $in: employerIds } }),
    AdminUser.deleteMany({ userId: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);

  return users.length;
}

import { Report } from '../../models/Report';
import type { ReportReason, ReportStatus, ReportTargetType } from '../../constants/enums';
import { SEED_COUNTS } from '../config';
import { daysAgo } from '../helpers/dates';
import { createSeededRng, pick } from '../helpers/rng';
import type { SeedContext } from '../types';

const REASONS: ReportReason[] = [
  'fraud',
  'scam',
  'fake_job',
  'misleading_information',
  'spam',
  'inappropriate_content',
  'duplicate_listing',
  'other',
];

const STATUSES: ReportStatus[] = ['pending', 'reviewing', 'resolved', 'dismissed'];

export async function seedReports(ctx: SeedContext): Promise<void> {
  const rng = createSeededRng(131);
  const target = SEED_COUNTS.reports;
  const reviewer = ctx.admins[0];

  // Remove prior demo reports from demo reporters for repeatable counts
  const demoUserIds = [
    ...ctx.candidates.map((c) => c.userId),
    ...ctx.employers.map((e) => e.userId),
  ];
  await Report.deleteMany({ reporterId: { $in: demoUserIds } });

  let created = 0;
  for (let i = 0; i < target; i += 1) {
    const reporter = ctx.candidates[i % ctx.candidates.length]!;
    const status = STATUSES[i % STATUSES.length]!;
    let targetType: ReportTargetType;
    let targetId;

    if (i % 4 === 0) {
      targetType = 'job';
      targetId = ctx.jobs[i % ctx.jobs.length]!.jobId;
    } else if (i % 4 === 1) {
      targetType = 'company';
      targetId = ctx.employers[i % ctx.employers.length]!.companyId;
    } else if (i % 4 === 2) {
      targetType = 'employer';
      targetId = ctx.employers[i % ctx.employers.length]!.employerId;
    } else {
      targetType = 'candidate';
      targetId = ctx.candidates[(i + 3) % ctx.candidates.length]!.candidateId;
    }

    const reason = pick(rng, REASONS);

    await Report.create({
      reporterId: reporter.userId,
      targetType,
      targetId,
      reason,
      description: `Demo report about ${targetType} (${reason.replace(/_/g, ' ')}).`,
      status,
      reviewedBy:
        status === 'resolved' || status === 'dismissed' ? reviewer?.userId : undefined,
      reviewedAt:
        status === 'resolved' || status === 'dismissed' ? daysAgo(Math.floor(rng() * 10)) : undefined,
      resolution:
        status === 'resolved'
          ? 'Reviewed and actioned in demo environment.'
          : status === 'dismissed'
            ? 'Dismissed after review — no policy violation found.'
            : '',
      createdAt: daysAgo(Math.floor(rng() * 45)),
    });
    created += 1;
  }

  ctx.summary.reports = created;
}

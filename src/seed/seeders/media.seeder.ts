/**
 * D3/D4 media integrity: ensure demo MediaFile rows have on-disk bytes,
 * and attach public logos/avatars/article images for demo personas.
 */
import { Types } from 'mongoose';
import { MEDIA_REF_PREFIX } from '../../constants/media';
import { Candidate } from '../../models/Candidate';
import { CareerArticle } from '../../models/CareerArticle';
import { Company } from '../../models/Company';
import { MediaFile } from '../../models/MediaFile';
import { User } from '../../models/User';
import { publicMediaUrl } from '../../utils/mediaMapper';
import { DEMO_EMAIL_DOMAIN, DEMO_STORAGE_PREFIX, demoEmail } from '../config';
import { DEMO_PERSONAS } from '../data/personas';
import { DEMO_PDF_BUFFER, DEMO_PNG_BUFFER, ensureDemoFile } from '../helpers/demoAssets';
import { daysAgo } from '../helpers/dates';
import type { SeedContext } from '../types';

async function upsertPublicImage(input: {
  ownerUserId: Types.ObjectId;
  ownerType: 'candidate' | 'employer' | 'admin';
  entityType: 'candidate' | 'user' | 'company' | 'article';
  entityId: Types.ObjectId;
  category: 'candidate_avatar' | 'company_logo' | 'career_article_image';
  storageKey: string;
  originalName: string;
}): Promise<{ mediaId: Types.ObjectId; url: string }> {
  await ensureDemoFile(input.storageKey, DEMO_PNG_BUFFER);
  const media = await MediaFile.findOneAndUpdate(
    { storageKey: input.storageKey },
    {
      $set: {
        ownerUserId: input.ownerUserId,
        ownerType: input.ownerType,
        entityType: input.entityType,
        entityId: input.entityId,
        category: input.category,
        visibility: 'public',
        originalName: input.originalName,
        storedName: input.storageKey.split('/').pop()!,
        mimeType: 'image/png',
        extension: '.png',
        size: DEMO_PNG_BUFFER.length,
        storageProvider: 'local',
        storageKey: input.storageKey,
        status: 'active',
        uploadedAt: daysAgo(3),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  return { mediaId: media._id, url: publicMediaUrl(media._id.toString()) };
}

export async function seedMediaAssets(ctx: SeedContext): Promise<void> {
  // 1) Ensure every demo/* MediaFile has bytes on disk
  const demoMedia = await MediaFile.find({
    storageKey: { $regex: /^demo\// },
    status: 'active',
  }).select('_id storageKey category mimeType');

  let filesEnsured = 0;
  for (const media of demoMedia) {
    const buffer =
      media.category === 'candidate_resume' || media.mimeType === 'application/pdf'
        ? DEMO_PDF_BUFFER
        : DEMO_PNG_BUFFER;
    await ensureDemoFile(media.storageKey, buffer);
    // Keep size truthful for verification
    if (media.category === 'candidate_resume') {
      await MediaFile.updateOne(
        { _id: media._id },
        { $set: { size: DEMO_PDF_BUFFER.length, mimeType: 'application/pdf', extension: '.pdf' } },
      );
    }
    filesEnsured += 1;
  }

  // 2) Persona avatars (public media URLs)
  const avatarEmails = [
    demoEmail(DEMO_PERSONAS.candidateComplete.emailLocal),
    demoEmail(DEMO_PERSONAS.candidateActive.emailLocal),
  ];
  for (const email of avatarEmails) {
    const user = await User.findOne({ email });
    const candidate = user ? await Candidate.findOne({ userId: user._id }) : null;
    if (!user || !candidate) continue;
    const { url } = await upsertPublicImage({
      ownerUserId: user._id,
      ownerType: 'candidate',
      entityType: 'user',
      entityId: user._id,
      category: 'candidate_avatar',
      storageKey: `${DEMO_STORAGE_PREFIX}/candidate_avatar/${user._id.toString()}.png`,
      originalName: `${email.split('@')[0]}-avatar.png`,
    });
    await User.updateOne({ _id: user._id }, { $set: { avatar: url } });
    await Candidate.updateOne({ _id: candidate._id }, { $set: { profilePhoto: url } });
    filesEnsured += 1;
  }

  // Incomplete persona: ensure no resume media required; leave avatar optional
  // 3) Company logos for active + paid employers
  for (const employer of ctx.employers.filter(
    (e) =>
      e.email === demoEmail(DEMO_PERSONAS.employerActive.emailLocal) ||
      e.email === demoEmail(DEMO_PERSONAS.employerPaid.emailLocal),
  )) {
    const { url } = await upsertPublicImage({
      ownerUserId: employer.userId,
      ownerType: 'employer',
      entityType: 'company',
      entityId: employer.companyId,
      category: 'company_logo',
      storageKey: `${DEMO_STORAGE_PREFIX}/company_logo/${employer.companySlug}.png`,
      originalName: `${employer.companySlug}-logo.png`,
    });
    await Company.updateOne({ _id: employer.companyId }, { $set: { logo: url } });
    filesEnsured += 1;
  }

  // 4) Featured images for a few published articles
  const articles = await CareerArticle.find({
    status: 'published',
    authorId: { $in: ctx.admins.map((a) => a.userId) },
  })
    .sort({ publishedAt: -1 })
    .limit(8);

  const author = ctx.admins[0];
  if (author) {
    for (const article of articles) {
      const { url } = await upsertPublicImage({
        ownerUserId: author.userId,
        ownerType: 'admin',
        entityType: 'article',
        entityId: article._id,
        category: 'career_article_image',
        storageKey: `${DEMO_STORAGE_PREFIX}/career_article_image/${article.slug}.png`,
        originalName: `${article.slug}-cover.png`,
      });
      await CareerArticle.updateOne({ _id: article._id }, { $set: { featuredImage: url } });
      filesEnsured += 1;
    }
  }

  // Recount demo media for summary
  const mediaCount = await MediaFile.countDocuments({
    storageKey: { $regex: /^demo\// },
    status: 'active',
  });
  ctx.summary.mediaFiles = mediaCount;

  // Sanity: resume refs still use media: prefix (private)
  const resumeCount = await Candidate.countDocuments({
    userId: {
      $in: (
        await User.find({
          email: { $regex: `@${DEMO_EMAIL_DOMAIN}$`, $options: 'i' },
          role: 'candidate',
        }).select('_id')
      ).map((u) => u._id),
    },
    resume: { $regex: `^${MEDIA_REF_PREFIX}` },
  });
  void resumeCount;
  void filesEnsured;
}

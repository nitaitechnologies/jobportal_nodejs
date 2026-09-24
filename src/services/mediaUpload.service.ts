import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { CareerArticle } from '../models/CareerArticle';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { MediaFile } from '../models/MediaFile';
import { User } from '../models/User';
import type {
  AuthenticatedAdmin,
  AuthenticatedCandidate,
  AuthenticatedEmployer,
} from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { getCandidateProfileCompletionDetails } from '../utils/candidateProfileCompletion';
import { mapResumeMetadata, mapVideoResumeMetadata } from '../utils/candidateProfileMapper';
import { mapSafeMedia, parseMediaRef } from '../utils/mediaMapper';
import {
  deleteMediaByRef,
  getActiveMediaById,
  hasStoredMedia,
  readMediaBuffer,
  uploadMedia,
} from './media.service';
import { companyVerificationService } from './companyVerification.service';

function parseDurationSeconds(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw));
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError('Invalid durationSeconds', HTTP_STATUS.BAD_REQUEST, [
      { path: 'durationSeconds', message: 'Must be a non-negative number' },
    ]);
  }
  return n;
}

/** Videos require durationSeconds — omit → undefined so validator rejects. */
function requireVideoDurationSeconds(raw: unknown): number {
  const parsed = parseDurationSeconds(raw);
  if (parsed === undefined) {
    throw new AppError('Video duration is required', HTTP_STATUS.BAD_REQUEST, [
      {
        path: 'durationSeconds',
        message: 'Provide durationSeconds for video uploads',
      },
    ]);
  }
  return parsed;
}

async function loadCandidatePair(userId: string) {
  const [user, candidate] = await Promise.all([
    User.findById(userId).select('name email phone role avatar status deletedAt'),
    Candidate.findOne({ userId }),
  ]);
  if (!user || user.role !== 'candidate' || user.deletedAt || user.status !== 'active' || !candidate) {
    throw new AppError('Candidate access denied', HTTP_STATUS.FORBIDDEN);
  }
  return { user, candidate };
}

export class MediaUploadService {
  async uploadCandidateAvatar(candidate: AuthenticatedCandidate, file: Express.Multer.File) {
    const { user } = await loadCandidatePair(candidate.userId);
    const previous = user.avatar ?? '';

    const uploaded = await uploadMedia({
      category: 'candidate_avatar',
      ownerUserId: candidate.userId,
      ownerType: 'candidate',
      entityType: 'user',
      entityId: candidate.userId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef: previous,
    });

    user.avatar = uploaded.domainRef;
    await user.save();

    const candidateDoc = await Candidate.findById(candidate.candidateId);
    if (candidateDoc) {
      const oldPhoto = candidateDoc.profilePhoto ?? '';
      candidateDoc.profilePhoto = uploaded.domainRef;
      await candidateDoc.save();
      if (oldPhoto && oldPhoto !== previous) {
        await deleteMediaByRef(oldPhoto).catch(() => undefined);
      }
    }

    return {
      avatar: uploaded.domainRef,
      media: uploaded.media,
    };
  }

  async deleteCandidateAvatar(candidate: AuthenticatedCandidate) {
    const { user } = await loadCandidatePair(candidate.userId);
    const previous = user.avatar ?? '';
    user.avatar = '';
    await user.save();

    const candidateDoc = await Candidate.findById(candidate.candidateId);
    if (candidateDoc) {
      const photo = candidateDoc.profilePhoto ?? '';
      candidateDoc.profilePhoto = '';
      await candidateDoc.save();
      await deleteMediaByRef(photo, { ownerUserId: candidate.userId });
    }
    await deleteMediaByRef(previous, { ownerUserId: candidate.userId });

    return { avatar: '', deleted: true };
  }

  async uploadCandidateResume(candidate: AuthenticatedCandidate, file: Express.Multer.File) {
    const { user, candidate: candidateDoc } = await loadCandidatePair(candidate.userId);
    const previous = candidateDoc.resume ?? '';

    const uploaded = await uploadMedia({
      category: 'candidate_resume',
      ownerUserId: candidate.userId,
      ownerType: 'candidate',
      entityType: 'candidate',
      entityId: candidate.candidateId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef: previous,
    });

    candidateDoc.resume = uploaded.domainRef;
    await candidateDoc.save();

    const completion = getCandidateProfileCompletionDetails(
      { name: user.name, phone: user.phone, avatar: user.avatar },
      candidateDoc,
    );
    candidateDoc.profileCompletion = completion.percentage;
    await candidateDoc.save();

    return {
      resume: {
        hasResume: true,
        media: uploaded.media,
        downloadUrl: `${env.apiPrefix}/candidate/profile/resume/download`,
      },
      completion: {
        percentage: completion.percentage,
      },
    };
  }

  async getCandidateResume(candidate: AuthenticatedCandidate) {
    const { candidate: candidateDoc } = await loadCandidatePair(candidate.userId);
    const mediaId = parseMediaRef(candidateDoc.resume);
    let media = null;
    if (mediaId) {
      try {
        const doc = await getActiveMediaById(mediaId);
        media = mapSafeMedia(doc);
      } catch {
        media = null;
      }
    }

    const stored = hasStoredMedia(candidateDoc.resume);
    return {
      resume: {
        hasResume: stored,
        // Never leak media: refs or filesystem paths
        resume: stored ? null : candidateDoc.resume || '',
        media,
        downloadUrl: stored ? `${env.apiPrefix}/candidate/profile/resume/download` : null,
      },
    };
  }

  /**
   * Selectable resumes for one-tap / apply UI (066).
   * Returns profile default + any other active owned candidate_resume media.
   */
  async listSelectableResumes(candidate: AuthenticatedCandidate) {
    const { candidate: candidateDoc } = await loadCandidatePair(candidate.userId);
    const profileRef = (candidateDoc.resume ?? '').trim();
    const profileMediaId = parseMediaRef(profileRef);

    const files = await MediaFile.find({
      ownerUserId: candidate.userId,
      category: 'candidate_resume',
      status: 'active',
    })
      .sort({ createdAt: -1 })
      .limit(20);

    const resumes: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      size: number;
      isProfileDefault: boolean;
      createdAt: Date | null;
    }> = files.map((file) => {
      const ref = `media:${file._id.toString()}`;
      return {
        id: ref,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        isProfileDefault: profileMediaId === file._id.toString(),
        createdAt: file.createdAt ?? null,
      };
    });

    // External URL profile resume (no media file) still selectable by omitting resume on apply.
    if (profileRef && !profileMediaId && /^https?:\/\//i.test(profileRef)) {
      resumes.unshift({
        id: profileRef,
        originalName: 'Profile resume (URL)',
        mimeType: 'application/octet-stream',
        size: 0,
        isProfileDefault: true,
        createdAt: null,
      });
    }

    return {
      resumes,
      profileDefaultId: profileRef || null,
      /** Pass this value (or omit) on POST .../apply to reuse profile resume. */
      applyHint:
        'Omit resume for profile default, or send resume with an id from this list.',
    };
  }

  async downloadCandidateResume(candidate: AuthenticatedCandidate) {
    const { candidate: candidateDoc } = await loadCandidatePair(candidate.userId);
    const mediaId = parseMediaRef(candidateDoc.resume);
    if (!mediaId) {
      throw new AppError('Resume file not found', HTTP_STATUS.NOT_FOUND);
    }
    const { media, buffer } = await readMediaBuffer(mediaId);
    if (media.ownerUserId.toString() !== candidate.userId) {
      throw new AppError('Resume access denied', HTTP_STATUS.FORBIDDEN);
    }
    if (media.category !== 'candidate_resume') {
      throw new AppError('Resume access denied', HTTP_STATUS.FORBIDDEN);
    }
    return { media, buffer };
  }

  async deleteCandidateResume(candidate: AuthenticatedCandidate) {
    const { user, candidate: candidateDoc } = await loadCandidatePair(candidate.userId);
    const previous = candidateDoc.resume ?? '';
    candidateDoc.resume = '';
    await candidateDoc.save();
    await deleteMediaByRef(previous, { ownerUserId: candidate.userId });

    const completion = getCandidateProfileCompletionDetails(
      { name: user.name, phone: user.phone, avatar: user.avatar },
      candidateDoc,
    );
    candidateDoc.profileCompletion = completion.percentage;
    await candidateDoc.save();

    return {
      resume: mapResumeMetadata(candidateDoc),
      completion: {
        percentage: completion.percentage,
      },
    };
  }

  async uploadCandidateVideoResume(
    candidate: AuthenticatedCandidate,
    file: Express.Multer.File,
    durationSecondsRaw?: unknown,
  ) {
    const { candidate: candidateDoc } = await loadCandidatePair(candidate.userId);
    const previous = candidateDoc.videoResume ?? '';
    const durationSeconds = requireVideoDurationSeconds(durationSecondsRaw);

    const uploaded = await uploadMedia({
      category: 'candidate_video_resume',
      ownerUserId: candidate.userId,
      ownerType: 'candidate',
      entityType: 'candidate',
      entityId: candidate.candidateId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef: previous,
      durationSeconds,
    });

    candidateDoc.videoResume = uploaded.domainRef;
    await candidateDoc.save();

    return {
      videoResume: {
        hasVideoResume: true,
        media: uploaded.media,
        downloadUrl: `${env.apiPrefix}/candidate/profile/video-resume/download`,
        maxSeconds: env.videoMaxSeconds,
        maxBytes: env.videoMaxBytes,
      },
    };
  }

  async getCandidateVideoResume(candidate: AuthenticatedCandidate) {
    const { candidate: candidateDoc } = await loadCandidatePair(candidate.userId);
    const mediaId = parseMediaRef(candidateDoc.videoResume);
    let media = null;
    if (mediaId) {
      try {
        const doc = await getActiveMediaById(mediaId);
        media = mapSafeMedia(doc);
      } catch {
        media = null;
      }
    }

    const stored = hasStoredMedia(candidateDoc.videoResume);
    return {
      videoResume: {
        hasVideoResume: stored,
        media,
        downloadUrl: stored
          ? `${env.apiPrefix}/candidate/profile/video-resume/download`
          : null,
        maxSeconds: env.videoMaxSeconds,
        maxBytes: env.videoMaxBytes,
      },
    };
  }

  async downloadCandidateVideoResume(candidate: AuthenticatedCandidate) {
    const { candidate: candidateDoc } = await loadCandidatePair(candidate.userId);
    const mediaId = parseMediaRef(candidateDoc.videoResume);
    if (!mediaId) {
      throw new AppError('Video resume not found', HTTP_STATUS.NOT_FOUND);
    }
    const { media, buffer } = await readMediaBuffer(mediaId);
    if (media.ownerUserId.toString() !== candidate.userId) {
      throw new AppError('Video resume access denied', HTTP_STATUS.FORBIDDEN);
    }
    if (media.category !== 'candidate_video_resume') {
      throw new AppError('Video resume access denied', HTTP_STATUS.FORBIDDEN);
    }
    return { media, buffer };
  }

  async deleteCandidateVideoResume(candidate: AuthenticatedCandidate) {
    const { candidate: candidateDoc } = await loadCandidatePair(candidate.userId);
    const previous = candidateDoc.videoResume ?? '';
    candidateDoc.videoResume = '';
    await candidateDoc.save();
    await deleteMediaByRef(previous, { ownerUserId: candidate.userId });
    return {
      videoResume: mapVideoResumeMetadata(candidateDoc),
      deleted: true,
    };
  }

  async uploadJobVideoJd(
    employer: AuthenticatedEmployer,
    jobId: string,
    file: Express.Multer.File,
    durationSecondsRaw?: unknown,
  ) {
    const job = await Job.findOne({
      _id: jobId,
      employerId: employer.employerId,
      deletedAt: null,
    });
    if (!job) throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);

    const previous = job.videoJd ?? '';
    const durationSeconds = requireVideoDurationSeconds(durationSecondsRaw);

    const uploaded = await uploadMedia({
      category: 'job_video_jd',
      ownerUserId: employer.userId,
      ownerType: 'employer',
      entityType: 'job',
      entityId: jobId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef: previous,
      durationSeconds,
    });

    job.videoJd = uploaded.domainRef;
    await job.save();

    return {
      videoJd: uploaded.domainRef,
      hasVideoJd: true,
      media: uploaded.media,
      maxSeconds: env.videoMaxSeconds,
      maxBytes: env.videoMaxBytes,
    };
  }

  async deleteJobVideoJd(employer: AuthenticatedEmployer, jobId: string) {
    const job = await Job.findOne({
      _id: jobId,
      employerId: employer.employerId,
      deletedAt: null,
    });
    if (!job) throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);

    const previous = job.videoJd ?? '';
    job.videoJd = '';
    await job.save();
    await deleteMediaByRef(previous, { ownerUserId: employer.userId });
    return { videoJd: '', hasVideoJd: false, deleted: true };
  }

  async uploadApplicationVideoResume(
    candidate: AuthenticatedCandidate,
    applicationId: string,
    file: Express.Multer.File,
    durationSecondsRaw?: unknown,
  ) {
    const application = await Application.findOne({
      _id: applicationId,
      candidateId: candidate.candidateId,
    });
    if (!application) throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);

    const previous = application.videoResume ?? '';
    const durationSeconds = requireVideoDurationSeconds(durationSecondsRaw);

    const uploaded = await uploadMedia({
      category: 'candidate_video_resume',
      ownerUserId: candidate.userId,
      ownerType: 'candidate',
      entityType: 'application',
      entityId: applicationId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef: previous,
      durationSeconds,
    });

    application.videoResume = uploaded.domainRef;
    await application.save();

    return {
      videoResume: {
        hasVideoResume: true,
        media: uploaded.media,
        downloadUrl: `${env.apiPrefix}/candidate/applications/${applicationId}/video-resume/download`,
      },
    };
  }

  async downloadApplicationVideoResumeForCandidate(
    candidate: AuthenticatedCandidate,
    applicationId: string,
  ) {
    const application = await Application.findOne({
      _id: applicationId,
      candidateId: candidate.candidateId,
    });
    if (!application) throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);

    const mediaId = parseMediaRef(application.videoResume);
    if (!mediaId) throw new AppError('Video resume not found', HTTP_STATUS.NOT_FOUND);

    const { media, buffer } = await readMediaBuffer(mediaId);
    if (media.ownerUserId.toString() !== candidate.userId) {
      throw new AppError('Video resume access denied', HTTP_STATUS.FORBIDDEN);
    }
    if (media.category !== 'candidate_video_resume') {
      throw new AppError('Video resume access denied', HTTP_STATUS.FORBIDDEN);
    }
    return { media, buffer };
  }

  async deleteApplicationVideoResume(candidate: AuthenticatedCandidate, applicationId: string) {
    const application = await Application.findOne({
      _id: applicationId,
      candidateId: candidate.candidateId,
    });
    if (!application) throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);

    const previous = application.videoResume ?? '';
    application.videoResume = '';
    await application.save();
    await deleteMediaByRef(previous, { ownerUserId: candidate.userId });
    return { hasVideoResume: false, deleted: true };
  }

  async downloadApplicationVideoResumeForEmployer(
    employer: AuthenticatedEmployer,
    applicationId: string,
  ) {
    const application = await Application.findOne({
      _id: applicationId,
      employerId: employer.employerId,
    });
    if (!application) throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);

    const mediaId = parseMediaRef(application.videoResume);
    if (!mediaId) throw new AppError('Video resume not found', HTTP_STATUS.NOT_FOUND);

    const { media, buffer } = await readMediaBuffer(mediaId);
    if (media.category !== 'candidate_video_resume') {
      throw new AppError('Video resume access denied', HTTP_STATUS.FORBIDDEN);
    }
    return { media, buffer };
  }

  private async loadEmployerVisibleCandidate(candidateId: string) {
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    const candidate = await Candidate.findOne({
      _id: candidateId,
      profileVisibility: { $in: ['public', 'employers_only'] },
    });
    if (!candidate) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);

    const user = await User.findOne({
      _id: candidate.userId,
      role: 'candidate',
      status: 'active',
    }).select('_id');
    if (!user) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);

    return candidate;
  }

  async downloadCandidateResumeForEmployer(
    _employer: AuthenticatedEmployer,
    candidateId: string,
  ) {
    const candidate = await this.loadEmployerVisibleCandidate(candidateId);
    const mediaId = parseMediaRef(candidate.resume);
    if (!mediaId) {
      throw new AppError('Resume file not found', HTTP_STATUS.NOT_FOUND);
    }
    const { media, buffer } = await readMediaBuffer(mediaId);
    if (media.category !== 'candidate_resume') {
      throw new AppError('Resume access denied', HTTP_STATUS.FORBIDDEN);
    }
    return { media, buffer };
  }

  async downloadCandidateVideoResumeForEmployer(
    _employer: AuthenticatedEmployer,
    candidateId: string,
  ) {
    const candidate = await this.loadEmployerVisibleCandidate(candidateId);
    const mediaId = parseMediaRef(candidate.videoResume);
    if (!mediaId) {
      throw new AppError('Video resume not found', HTTP_STATUS.NOT_FOUND);
    }
    const { media, buffer } = await readMediaBuffer(mediaId);
    if (media.category !== 'candidate_video_resume') {
      throw new AppError('Video resume access denied', HTTP_STATUS.FORBIDDEN);
    }
    return { media, buffer };
  }

  async uploadCompanyLogo(employer: AuthenticatedEmployer, file: Express.Multer.File) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const uploaded = await uploadMedia({
      category: 'company_logo',
      ownerUserId: employer.userId,
      ownerType: 'employer',
      entityType: 'company',
      entityId: employer.companyId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef: company.logo ?? '',
    });

    company.logo = uploaded.domainRef;
    await company.save();
    return { logo: uploaded.domainRef, media: uploaded.media };
  }

  async deleteCompanyLogo(employer: AuthenticatedEmployer) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    const previous = company.logo ?? '';
    company.logo = '';
    await company.save();
    await deleteMediaByRef(previous, { ownerUserId: employer.userId });
    return { logo: '', deleted: true };
  }

  async uploadCompanyCover(employer: AuthenticatedEmployer, file: Express.Multer.File) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const uploaded = await uploadMedia({
      category: 'company_cover',
      ownerUserId: employer.userId,
      ownerType: 'employer',
      entityType: 'company',
      entityId: employer.companyId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef: company.coverImage ?? '',
    });

    company.coverImage = uploaded.domainRef;
    await company.save();
    return { coverImage: uploaded.domainRef, media: uploaded.media };
  }

  async deleteCompanyCover(employer: AuthenticatedEmployer) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    const previous = company.coverImage ?? '';
    company.coverImage = '';
    await company.save();
    await deleteMediaByRef(previous, { ownerUserId: employer.userId });
    return { coverImage: '', deleted: true };
  }

  async uploadCompanyGalleryItem(
    employer: AuthenticatedEmployer,
    file: Express.Multer.File,
    caption = '',
  ) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const current = Array.isArray(company.gallery)
      ? company.gallery.map((entry, index) => ({
          url: String(entry.url ?? ''),
          type: (entry.type === 'video' ? 'video' : 'image') as 'image' | 'video',
          caption: String(entry.caption ?? ''),
          sortOrder: typeof entry.sortOrder === 'number' ? entry.sortOrder : index,
        }))
      : [];
    if (current.length >= 20) {
      throw new AppError('Gallery limit reached (max 20 items)', HTTP_STATUS.BAD_REQUEST);
    }

    const uploaded = await uploadMedia({
      category: 'company_gallery',
      ownerUserId: employer.userId,
      ownerType: 'employer',
      entityType: 'company',
      entityId: employer.companyId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef: '',
    });

    const item = {
      url: uploaded.domainRef,
      type: 'image' as const,
      caption: caption.trim().slice(0, 200),
      sortOrder: current.length,
    };
    current.push(item);
    company.set('gallery', current);
    await company.save();

    return {
      item,
      gallery: current,
      media: uploaded.media,
    };
  }

  async deleteCompanyGalleryItem(employer: AuthenticatedEmployer, index: number) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const current = Array.isArray(company.gallery) ? [...company.gallery] : [];
    if (!Number.isInteger(index) || index < 0 || index >= current.length) {
      throw new AppError('Gallery item not found', HTTP_STATUS.NOT_FOUND);
    }

    const [removed] = current.splice(index, 1);
    const reindexed = current.map((entry, i) => ({
      url: entry.url,
      type: entry.type === 'video' ? 'video' : 'image',
      caption: entry.caption ?? '',
      sortOrder: i,
    }));
    company.set('gallery', reindexed);
    await company.save();
    await deleteMediaByRef(removed?.url ?? '', { ownerUserId: employer.userId });

    return {
      deleted: true,
      gallery: reindexed,
    };
  }

  async uploadCompanyVerificationDocument(
    employer: AuthenticatedEmployer,
    file: Express.Multer.File,
    type: 'pan' | 'gst' | 'incorporation' | 'other',
  ) {
    const company = await Company.findById(employer.companyId);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const existing = Array.isArray(company.documents) ? company.documents : [];
    const previous = existing.find((d) => d.type === type);
    const previousRef = previous?.mediaUrl ?? '';

    const uploaded = await uploadMedia({
      category: 'company_verification_doc',
      ownerUserId: employer.userId,
      ownerType: 'employer',
      entityType: 'company',
      entityId: employer.companyId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef,
    });

    const verification = await companyVerificationService.attachDocument(
      employer,
      type,
      uploaded.domainRef,
    );

    return {
      type,
      media: uploaded.media,
      verification: verification.status,
    };
  }

  async uploadArticleImage(admin: AuthenticatedAdmin, articleId: string, file: Express.Multer.File) {
    const article = await CareerArticle.findById(articleId);
    if (!article) throw new AppError('Article not found', HTTP_STATUS.NOT_FOUND);

    const uploaded = await uploadMedia({
      category: 'career_article_image',
      ownerUserId: admin.userId,
      ownerType: 'admin',
      entityType: 'article',
      entityId: articleId,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
      previousRef: article.featuredImage ?? '',
    });

    article.featuredImage = uploaded.domainRef;
    await article.save();
    return { featuredImage: uploaded.domainRef, media: uploaded.media };
  }

  async deleteArticleImage(_admin: AuthenticatedAdmin, articleId: string) {
    const article = await CareerArticle.findById(articleId);
    if (!article) throw new AppError('Article not found', HTTP_STATUS.NOT_FOUND);
    const previous = article.featuredImage ?? '';
    article.featuredImage = '';
    await article.save();
    await deleteMediaByRef(previous);
    return { featuredImage: '', deleted: true };
  }

  async streamPublicMedia(mediaId: string) {
    const { media, buffer } = await readMediaBuffer(mediaId);
    if (media.visibility !== 'public') {
      throw new AppError('File not found', HTTP_STATUS.NOT_FOUND);
    }
    if (media.category === 'job_video_jd' && !env.enableVideoJd) {
      throw new AppError('File not found', HTTP_STATUS.NOT_FOUND);
    }
    return { media, buffer };
  }

  /** Private chat attachment owned by the uploading conversation member. */
  async uploadChatAttachment(
    actor: { userId: string; role: 'candidate' | 'employer' },
    conversation: { _id: mongoose.Types.ObjectId; applicationId: mongoose.Types.ObjectId },
    file: Express.Multer.File,
  ) {
    const uploaded = await uploadMedia({
      category: 'chat_attachment',
      ownerUserId: actor.userId,
      ownerType: actor.role,
      entityType: 'application',
      entityId: conversation.applicationId.toString(),
      originalName: file.originalname,
      declaredMime: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    });

    return {
      mediaRef: uploaded.domainRef,
      mediaId: uploaded.mediaId,
      fileName: file.originalname || uploaded.media.originalName,
      mimeType: file.mimetype || uploaded.media.mimeType,
      media: uploaded.media,
    };
  }
}

export const mediaUploadService = new MediaUploadService();

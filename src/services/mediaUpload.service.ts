import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { CareerArticle } from '../models/CareerArticle';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
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
}

export const mediaUploadService = new MediaUploadService();

import { Types } from 'mongoose';
import { MEDIA_REF_PREFIX } from '../../constants/media';
import { Candidate } from '../../models/Candidate';
import { MediaFile } from '../../models/MediaFile';
import { User } from '../../models/User';
import { calculateCandidateProfileCompletion } from '../../utils/candidateProfileCompletion';
import { hashPassword } from '../../utils/password';
import { DEMO_PASSWORD, DEMO_STORAGE_PREFIX, SEED_COUNTS, demoEmail } from '../config';
import { DEMO_PERSONAS } from '../data/personas';
import {
  CANDIDATE_FIRST_NAMES,
  DEGREES,
  JOB_PROFILES,
  LAST_NAMES,
  UNIVERSITIES,
} from '../data/people';
import { DEMO_PDF_BUFFER, ensureDemoFile } from '../helpers/demoAssets';
import { daysAgo } from '../helpers/dates';
import { chance, createSeededRng, intBetween, pick, pickN } from '../helpers/rng';
import type { SeedContext } from '../types';

/** Completeness tiers mapped to section combinations (backend calculates %). */
const COMPLETENESS_CYCLE = [20, 40, 60, 80, 100] as const;

function demoPhone(index: number): string {
  const base = 9000000000 + index;
  return `9${String(base).slice(-9)}`;
}

function personaForIndex(i: number): {
  email: string;
  name: string;
  tier: 20 | 40 | 60 | 80 | 100;
  personaKey?: string;
} | null {
  if (i === 0) {
    return {
      email: demoEmail(DEMO_PERSONAS.candidateComplete.emailLocal),
      name: DEMO_PERSONAS.candidateComplete.name,
      tier: DEMO_PERSONAS.candidateComplete.tier,
      personaKey: DEMO_PERSONAS.candidateComplete.key,
    };
  }
  if (i === 1) {
    return {
      email: demoEmail(DEMO_PERSONAS.candidateIncomplete.emailLocal),
      name: DEMO_PERSONAS.candidateIncomplete.name,
      tier: DEMO_PERSONAS.candidateIncomplete.tier,
      personaKey: DEMO_PERSONAS.candidateIncomplete.key,
    };
  }
  if (i === 2) {
    return {
      email: demoEmail(DEMO_PERSONAS.candidateActive.emailLocal),
      name: DEMO_PERSONAS.candidateActive.name,
      tier: DEMO_PERSONAS.candidateActive.tier,
      personaKey: DEMO_PERSONAS.candidateActive.key,
    };
  }
  return null;
}

export async function seedCandidates(ctx: SeedContext): Promise<void> {
  const rng = createSeededRng(42);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const count = SEED_COUNTS.candidates;

  // Avoid unique phone collisions when persona emails remapped from D1 numbered accounts.
  await User.updateMany(
    { email: { $regex: '@workindia\\.demo$', $options: 'i' }, role: 'candidate' },
    { $set: { phone: '' } },
  );

  for (let i = 0; i < count; i += 1) {
    const persona = personaForIndex(i);
    const first = CANDIDATE_FIRST_NAMES[i % CANDIDATE_FIRST_NAMES.length]!;
    const last = LAST_NAMES[i % LAST_NAMES.length]!;
    const name = persona?.name ?? `${first} ${last}`;
    const numberedLocal = `candidate.${String(i - 2).padStart(3, '0')}`;
    const email = persona?.email ?? demoEmail(numberedLocal);
    const phone = demoPhone(i + 1);
    const profile = JOB_PROFILES[i % JOB_PROFILES.length]!;
    const city = pick(rng, ctx.cities);
    const tier = persona?.tier ?? COMPLETENESS_CYCLE[i % COMPLETENESS_CYCLE.length]!;

    const includeBasic = tier >= 20;
    const includeAvatar = tier >= 20;
    const includeSkills = tier >= 20;
    const includeSummary = tier >= 40;
    const includeEducation = tier >= 60;
    const includeExperience = tier >= 60;
    const includePreferences = tier >= 80;
    const includeResume = tier >= 80;
    const includeAdditional = tier === 100;

    const skills = includeSkills ? pickN(rng, profile.skills, intBetween(rng, 2, profile.skills.length)) : [];
    const education = includeEducation
      ? [
          {
            degree: pick(rng, DEGREES),
            fieldOfStudy: profile.title.includes('Design') ? 'Design' : 'Computer Science',
            institution: pick(rng, UNIVERSITIES),
            startYear: 2014 + (i % 6),
            endYear: 2018 + (i % 6),
            grade: 'First Class',
            description: '',
          },
        ]
      : [];

    const workExperience = includeExperience
      ? [
          {
            jobTitle: profile.title,
            company: pick(rng, [
              'PixelCraft Labs',
              'Northwind Analytics',
              'BrightPath Solutions',
              'Orbit Retail',
              'Summit Consulting',
            ]),
            location: city.cityName ?? city.name,
            startDate: daysAgo(900 + i * 3),
            endDate: chance(rng, 0.35) ? undefined : daysAgo(30 + (i % 200)),
            isCurrent: chance(rng, 0.35),
            description: `Worked as ${profile.title} delivering measurable outcomes.`,
          },
        ]
      : [];

    const certifications = includeAdditional
      ? [
          {
            name: `${profile.title} Certificate`,
            issuer: 'Demo Skills Academy',
            issueDate: daysAgo(400),
            credentialId: `DEMO-CERT-${i + 1}`,
            credentialUrl: '',
          },
        ]
      : [];

    const languages = includeAdditional
      ? [
          { name: 'English', proficiency: 'fluent' as const },
          { name: 'Hindi', proficiency: 'native' as const },
        ]
      : [];

    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          email,
          phone: includeBasic ? phone : '',
          passwordHash,
          role: 'candidate',
          status: 'active',
          emailVerified: true,
          phoneVerified: includeBasic,
          avatar: includeAvatar ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}` : '',
          lastLoginAt: daysAgo(i % 20),
        },
        $unset: { deletedAt: 1 },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    let resumeRef = '';
    if (includeResume) {
      const storageKey = `${DEMO_STORAGE_PREFIX}/candidate_resume/${user._id.toString()}.pdf`;
      await ensureDemoFile(storageKey, DEMO_PDF_BUFFER);
      const media = await MediaFile.findOneAndUpdate(
        { storageKey },
        {
          $set: {
            ownerUserId: user._id,
            ownerType: 'candidate',
            entityType: 'candidate',
            entityId: new Types.ObjectId(), // updated after candidate create
            category: 'candidate_resume',
            visibility: 'private',
            originalName: `${first.toLowerCase()}-resume.pdf`,
            storedName: `${user._id.toString()}.pdf`,
            mimeType: 'application/pdf',
            extension: '.pdf',
            size: DEMO_PDF_BUFFER.length,
            storageProvider: 'local',
            storageKey,
            status: 'active',
            uploadedAt: daysAgo(10 + (i % 30)),
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
      resumeRef = `${MEDIA_REF_PREFIX}${media._id.toString()}`;
      ctx.summary.mediaFiles += 1;
    }

    const candidatePayload = {
      userId: user._id,
      headline: includeSummary ? `${profile.title} | ${city.cityName ?? city.name}` : '',
      bio: includeSummary
        ? `Fictional demo candidate specializing in ${profile.title.toLowerCase()} opportunities across India.`
        : '',
      profilePhoto: includeAvatar ? (user.avatar ?? '') : '',
      dateOfBirth: includeBasic ? new Date(1992 + (i % 10), i % 12, 1 + (i % 27)) : undefined,
      gender: (i % 2 === 0 ? 'male' : 'female') as 'male' | 'female',
      currentLocation: includeBasic ? (city.displayName ?? city.name) : '',
      preferredLocations: includePreferences
        ? [city.cityName ?? city.name, pick(rng, ctx.cities).cityName ?? 'Bengaluru'].filter(
            (v, idx, arr) => arr.indexOf(v) === idx,
          )
        : [],
      currentJobTitle: includeExperience ? profile.title : '',
      currentCompany: includeExperience && workExperience[0] ? workExperience[0].company : '',
      totalExperience: includeExperience ? intBetween(rng, 1, 8) : 0,
      expectedSalary: includePreferences ? intBetween(rng, 25000, 120000) : undefined,
      noticePeriod: includePreferences ? pick(rng, [0, 15, 30, 60, 90]) : 0,
      employmentStatus: includePreferences
        ? pick(rng, ['looking', 'employed', 'freelancer', 'student'] as const)
        : 'looking',
      education,
      skills,
      languages,
      workExperience,
      certifications,
      resume: resumeRef,
      portfolio: includeAdditional ? `https://portfolio.example/${first.toLowerCase()}` : '',
      socialLinks: includeAdditional
        ? {
            linkedin: `https://linkedin.com/in/demo-${first.toLowerCase()}-${i + 1}`,
            github: (profile.skills as readonly string[]).includes('React') ||
            (profile.skills as readonly string[]).includes('Node.js')
              ? `https://github.com/demo-${first.toLowerCase()}`
              : '',
            website: '',
            twitter: '',
            facebook: '',
            instagram: '',
          }
        : {},
      profileVisibility: 'public' as const,
    };

    const completion = calculateCandidateProfileCompletion(
      { name: user.name, phone: user.phone, avatar: user.avatar },
      candidatePayload as unknown as Parameters<typeof calculateCandidateProfileCompletion>[1],
    );

    const candidate = await Candidate.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          ...candidatePayload,
          profileCompletion: completion,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    if (includeResume && resumeRef.startsWith(MEDIA_REF_PREFIX)) {
      const mediaId = resumeRef.slice(MEDIA_REF_PREFIX.length);
      await MediaFile.updateOne(
        { _id: mediaId },
        { $set: { entityId: candidate._id, entityType: 'candidate' } },
      );
    }

    ctx.candidates.push({
      userId: user._id,
      email,
      name,
      role: 'candidate',
      candidateId: candidate._id,
      profileCompletion: completion,
      personaKey: persona?.personaKey,
    });
  }

  ctx.summary.candidates = ctx.candidates.length;
}

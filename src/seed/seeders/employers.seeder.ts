import { Company } from '../../models/Company';
import { Employer } from '../../models/Employer';
import { User } from '../../models/User';
import { hashPassword } from '../../utils/password';
import { DEMO_PASSWORD, demoEmail } from '../config';
import { COMPANY_DEFS, companySlug } from '../data/companies';
import { DEMO_PERSONAS } from '../data/personas';
import { EMPLOYER_FIRST_NAMES, LAST_NAMES } from '../data/people';
import { daysAgo } from '../helpers/dates';
import type { SeedContext } from '../types';

export async function seedEmployersAndCompanies(ctx: SeedContext): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await User.updateMany(
    { email: { $regex: '@workindia\\.demo$', $options: 'i' }, role: 'employer' },
    { $set: { phone: '' } },
  );

  for (let i = 0; i < COMPANY_DEFS.length; i += 1) {
    const companyDef = COMPANY_DEFS[i]!;
    const slug = companySlug(companyDef.name);
    const first = EMPLOYER_FIRST_NAMES[i % EMPLOYER_FIRST_NAMES.length]!;
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length]!;
    const name = `${first} ${last}`;

    let email = demoEmail(`employer.${String(i + 1).padStart(3, '0')}`);
    let personaKey: string | undefined;
    let jobMode: 'busy' | 'drafts' | 'featured' | 'normal' | 'quiet' = 'normal';

    if (i === DEMO_PERSONAS.employerActive.companyIndex) {
      email = demoEmail(DEMO_PERSONAS.employerActive.emailLocal);
      personaKey = DEMO_PERSONAS.employerActive.key;
      jobMode = 'busy';
    } else if (i === DEMO_PERSONAS.employerNew.companyIndex) {
      email = demoEmail(DEMO_PERSONAS.employerNew.emailLocal);
      personaKey = DEMO_PERSONAS.employerNew.key;
      jobMode = 'drafts';
    } else if (i === DEMO_PERSONAS.employerPaid.companyIndex) {
      email = demoEmail(DEMO_PERSONAS.employerPaid.emailLocal);
      personaKey = DEMO_PERSONAS.employerPaid.key;
      jobMode = 'featured';
    } else if (i === COMPANY_DEFS.length - 1) {
      jobMode = 'quiet';
    }

    const phone = `98${String(10000000 + i).slice(-8)}`;

    // Keep busy/featured employers verified so published jobs stay publicly visible.
    let verificationStatus: 'verified' | 'pending' | 'unverified' | 'rejected' = 'verified';
    if (i === 1) verificationStatus = 'pending';
    else if (i === 3 || i === 7) verificationStatus = 'unverified';
    else if (i === 5) verificationStatus = 'unverified';
    else verificationStatus = 'verified';

    const company = await Company.findOneAndUpdate(
      { slug },
      {
        $set: {
          name: companyDef.name,
          slug,
          logo: '',
          coverImage: '',
          description: companyDef.description,
          website: companyDef.website,
          industry: companyDef.industry,
          companySize: companyDef.companySize,
          foundedYear: companyDef.foundedYear,
          headquarters: companyDef.headquarters,
          locations: companyDef.locations,
          contactEmail: demoEmail(`hr.${slug.replace(/-/g, '.')}`),
          contactPhone: phone,
          socialLinks: {
            linkedin: `https://linkedin.com/company/${slug}`,
            website: companyDef.website,
            twitter: '',
            facebook: '',
            instagram: '',
            github: '',
          },
          verificationStatus,
          status: 'active',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          email,
          phone,
          passwordHash,
          role: 'employer',
          status: 'active',
          emailVerified: true,
          phoneVerified: true,
          avatar: '',
          lastLoginAt: daysAgo(i % 14),
        },
        $unset: { deletedAt: 1 },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const employer = await Employer.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          companyId: company._id,
          designation: i % 2 === 0 ? 'Talent Acquisition Manager' : 'HR Manager',
          department: 'Human Resources',
          verified: verificationStatus === 'verified',
          status: 'active',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    ctx.employers.push({
      userId: user._id,
      email,
      name,
      role: 'employer',
      employerId: employer._id,
      companyId: company._id,
      companySlug: slug,
      companyName: companyDef.name,
      personaKey,
      jobMode,
    });
  }

  ctx.summary.employers = ctx.employers.length;
  ctx.summary.companies = ctx.employers.length;
}

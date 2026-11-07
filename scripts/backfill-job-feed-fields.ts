/**
 * Backfill public job-feed fields so Next.js can render distance, HR contacts,
 * gender preference, and applicant counts without gaps.
 *
 * Usage: npx ts-node scripts/backfill-job-feed-fields.ts
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { Company } from '../src/models/Company';
import { Job } from '../src/models/Job';
import { Location } from '../src/models/Location';
import { DELHI_ORIGIN } from '../src/utils/geo';

const GENDERS = ['any', 'any', 'male', 'female', 'any'] as const;

function demoPhone(seed: number, prefix: '8' | '9'): string {
  const body = String(100000000 + (seed % 899999999)).padStart(9, '0').slice(0, 9);
  return `9${prefix}${body}`.slice(0, 10);
}

async function main(): Promise<void> {
  await mongoose.connect(env.mongodbUri);
  console.log('Connected', env.mongodbUri);

  const delhiCity = await Location.findOne({
    status: 'active',
    type: 'city',
    name: { $regex: /^delhi$/i },
  }).select('_id name latitude longitude');

  const delhiLocationId = delhiCity?._id ?? null;
  const delhiLat =
    typeof delhiCity?.latitude === 'number' ? delhiCity.latitude : DELHI_ORIGIN.latitude;
  const delhiLng =
    typeof delhiCity?.longitude === 'number' ? delhiCity.longitude : DELHI_ORIGIN.longitude;

  const companies = await Company.find({}).select('_id contactPhone contactWhatsapp');
  let companiesPatched = 0;
  for (let i = 0; i < companies.length; i += 1) {
    const company = companies[i]!;
    const updates: Record<string, string> = {};
    if (!company.contactPhone?.trim()) {
      updates.contactPhone = demoPhone(i + 11, '8');
    }
    if (!company.contactWhatsapp?.trim()) {
      updates.contactWhatsapp = company.contactPhone?.trim() || demoPhone(i + 21, '9');
    }
    if (Object.keys(updates).length) {
      await Company.updateOne({ _id: company._id }, { $set: updates });
      companiesPatched += 1;
    }
  }

  const jobs = await Job.find({ deletedAt: null });
  let jobsPatched = 0;
  let coordsPatched = 0;
  let delhiDefaulted = 0;

  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i]!;
    const company = companies.find((row) => row._id.toString() === job.companyId.toString());
    const set: Record<string, unknown> = {};

    const city = (job.location?.city || '').trim();
    const hasCoords =
      typeof job.location?.latitude === 'number' &&
      typeof job.location?.longitude === 'number';

    if (!city || !hasCoords) {
      let lat = job.location?.latitude;
      let lng = job.location?.longitude;
      if (job.location?.locationId) {
        const loc = await Location.findById(job.location.locationId).select(
          'latitude longitude type name',
        );
        if (typeof loc?.latitude === 'number') lat = loc.latitude;
        if (typeof loc?.longitude === 'number') lng = loc.longitude;
      }
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        lat = delhiLat;
        lng = delhiLng;
        delhiDefaulted += 1;
      } else {
        coordsPatched += 1;
      }

      set.location = {
        locationId: job.location?.locationId || delhiLocationId || undefined,
        city: city || DELHI_ORIGIN.city,
        state: job.location?.state || DELHI_ORIGIN.state,
        country: job.location?.country || DELHI_ORIGIN.country,
        area: job.location?.area || '',
        displayName:
          job.location?.displayName ||
          [job.location?.area, city || DELHI_ORIGIN.city].filter(Boolean).join(', '),
        address: job.location?.address || '',
        placeId: job.location?.placeId || '',
        latitude: lat,
        longitude: lng,
      };
    }

    if (!job.genderPreference) {
      set.genderPreference = GENDERS[i % GENDERS.length];
    }

    const phone =
      job.contactPhone?.trim() ||
      company?.contactPhone?.trim() ||
      demoPhone(i + 31, '8');
    const whatsapp =
      job.contactWhatsapp?.trim() ||
      company?.contactWhatsapp?.trim() ||
      phone ||
      demoPhone(i + 41, '9');
    if (!job.contactPhone?.trim()) set.contactPhone = phone;
    if (!job.contactWhatsapp?.trim()) set.contactWhatsapp = whatsapp;

    if (typeof job.applicationsCount !== 'number') {
      set.applicationsCount = 0;
    }

    if (Object.keys(set).length) {
      await Job.updateOne({ _id: job._id }, { $set: set });
      jobsPatched += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        companies: companies.length,
        companiesPatched,
        jobs: jobs.length,
        jobsPatched,
        coordsPatched,
        delhiDefaulted,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

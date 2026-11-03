/**
 * Seed active homepage job-seeker reviews.
 *   npx ts-node scripts/seed-job-seeker-testimonials.ts
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { JobSeekerTestimonial } from '../src/models/JobSeekerTestimonial';

const SEED = [
  {
    seekerName: 'Anjali Sharma',
    companyName: 'Swiggy',
    roleTitle: 'Delivery Executive',
    quote:
      'I applied on Jobdeddy and got interview calls within 2 days. The process was simple and I joined Swiggy as a delivery executive with a clear salary offer.',
    rating: 5,
    avatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&h=160&q=80',
    status: 'active' as const,
    sortOrder: 1,
  },
  {
    seekerName: 'Rohit Kumar',
    companyName: 'Justdial',
    roleTitle: 'Telecaller',
    quote:
      'Jobdeddy helped me find a telecaller job near my home. Profiles were honest about shifts and pay, so I could choose confidently and start quickly.',
    rating: 5,
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&h=160&q=80',
    status: 'active' as const,
    sortOrder: 2,
  },
  {
    seekerName: 'Meera Patel',
    companyName: 'Urban Company',
    roleTitle: 'Beauty Therapist',
    quote:
      'After months of searching, I found the right beauty therapist role through Jobdeddy. The company called me the next day and I was hired within a week.',
    rating: 4,
    avatarUrl:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&h=160&q=80',
    status: 'active' as const,
    sortOrder: 3,
  },
  {
    seekerName: 'Vikas Yadav',
    companyName: 'Delhivery',
    roleTitle: 'Warehouse Associate',
    quote:
      'Jobdeddy made it easy to filter warehouse jobs by city and shift. I got selected at Delhivery and the joining formalities were clear from day one.',
    rating: 5,
    avatarUrl:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&h=160&q=80',
    status: 'active' as const,
    sortOrder: 4,
  },
  {
    seekerName: 'Sneha Reddy',
    companyName: "Byju's",
    roleTitle: 'Sales Executive',
    quote:
      'I was looking for a sales role after college. Jobdeddy showed verified openings and I landed a sales executive job with good incentives.',
    rating: 4,
    avatarUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&h=160&q=80',
    status: 'active' as const,
    sortOrder: 5,
  },
  {
    seekerName: 'Arjun Singh',
    companyName: 'Blinkit',
    roleTitle: 'Store Associate',
    quote:
      'Freshers like me get real opportunities here. I applied for store associate roles and Jobdeddy connected me with Blinkit in my area.',
    rating: 5,
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&h=160&q=80',
    status: 'active' as const,
    sortOrder: 6,
  },
];

async function main() {
  await connectDatabase();

  for (const item of SEED) {
    await JobSeekerTestimonial.findOneAndUpdate(
      { seekerName: item.seekerName, companyName: item.companyName },
      { $set: item },
      { upsert: true, new: true },
    );
    console.log(`✓ ${item.seekerName} @ ${item.companyName}`);
  }

  const total = await JobSeekerTestimonial.countDocuments({ status: 'active' });
  console.log(`Active job-seeker testimonials: ${total}`);
  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await disconnectDatabase();
  } catch {
    // ignore
  }
  process.exit(1);
});

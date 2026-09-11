export interface PersonSeed {
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
}

export const CANDIDATE_FIRST_NAMES = [
  'Aarav',
  'Vivaan',
  'Aditya',
  'Vihaan',
  'Arjun',
  'Sai',
  'Reyansh',
  'Ayaan',
  'Krishna',
  'Ishaan',
  'Ananya',
  'Diya',
  'Myra',
  'Aadhya',
  'Anika',
  'Sara',
  'Ira',
  'Pari',
  'Kiara',
  'Navya',
  'Rohan',
  'Kabir',
  'Yash',
  'Dev',
  'Nikhil',
  'Priya',
  'Neha',
  'Pooja',
  'Sneha',
  'Kavya',
  'Rahul',
  'Amit',
  'Suresh',
  'Meera',
  'Isha',
  'Tanvi',
  'Harsh',
  'Varun',
  'Nisha',
  'Ritu',
] as const;

export const LAST_NAMES = [
  'Sharma',
  'Verma',
  'Patel',
  'Reddy',
  'Nair',
  'Iyer',
  'Khan',
  'Singh',
  'Gupta',
  'Mehta',
  'Joshi',
  'Chopra',
  'Malhotra',
  'Kapoor',
  'Desai',
  'Banerjee',
  'Mukherjee',
  'Pillai',
  'Rao',
  'Kulkarni',
] as const;

export const EMPLOYER_FIRST_NAMES = [
  'Rajesh',
  'Sanjay',
  'Anita',
  'Vikram',
  'Deepa',
  'Manish',
  'Shalini',
  'Karan',
  'Nandini',
  'Abhishek',
  'Pooja',
  'Farhan',
] as const;

export const JOB_PROFILES = [
  {
    title: 'Frontend Developer',
    skills: ['React', 'TypeScript', 'CSS', 'HTML', 'Next.js'],
    categoryHint: 'Frontend Development',
  },
  {
    title: 'Backend Developer',
    skills: ['Node.js', 'Express', 'MongoDB', 'REST APIs', 'PostgreSQL'],
    categoryHint: 'Backend Development',
  },
  {
    title: 'Full Stack Developer',
    skills: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'AWS'],
    categoryHint: 'Full Stack Development',
  },
  {
    title: 'Flutter Developer',
    skills: ['Flutter', 'Dart', 'Firebase', 'REST APIs'],
    categoryHint: 'Mobile Development',
  },
  {
    title: 'Laravel Developer',
    skills: ['Laravel', 'PHP', 'MySQL', 'REST APIs'],
    categoryHint: 'Backend Development',
  },
  {
    title: 'UI/UX Designer',
    skills: ['Figma', 'Adobe XD', 'Wireframing', 'Prototyping', 'User Research'],
    categoryHint: 'UI/UX Design',
  },
  {
    title: 'Digital Marketer',
    skills: ['Google Ads', 'Meta Ads', 'Analytics', 'Email Marketing'],
    categoryHint: 'Digital Marketing',
  },
  {
    title: 'SEO Specialist',
    skills: ['SEO', 'Ahrefs', 'Content Strategy', 'Technical SEO'],
    categoryHint: 'SEO',
  },
  {
    title: 'Sales Executive',
    skills: ['Lead Generation', 'CRM', 'Negotiation', 'Cold Calling'],
    categoryHint: 'Inside Sales',
  },
  {
    title: 'HR Executive',
    skills: ['Recruitment', 'Onboarding', 'HRMS', 'Employee Relations'],
    categoryHint: 'Recruitment',
  },
  {
    title: 'Accountant',
    skills: ['Tally', 'GST', 'Bookkeeping', 'MS Excel'],
    categoryHint: 'Accounting',
  },
  {
    title: 'Customer Support',
    skills: ['Zendesk', 'Communication', 'Ticketing', 'Problem Solving'],
    categoryHint: 'Customer Support',
  },
  {
    title: 'Data Analyst',
    skills: ['SQL', 'Python', 'Tableau', 'Excel', 'Power BI'],
    categoryHint: 'Data Engineering',
  },
  {
    title: 'Graphic Designer',
    skills: ['Photoshop', 'Illustrator', 'Branding', 'Canva'],
    categoryHint: 'Graphic Design',
  },
  {
    title: 'Content Writer',
    skills: ['Copywriting', 'SEO Writing', 'Blogging', 'Editing'],
    categoryHint: 'Content Marketing',
  },
  {
    title: 'Business Development Executive',
    skills: ['Prospecting', 'Pitching', 'Partnerships', 'CRM'],
    categoryHint: 'Business Development',
  },
] as const;

export const UNIVERSITIES = [
  'Delhi University',
  'Mumbai University',
  'Bangalore University',
  'Osmania University',
  'Pune University',
  'Anna University',
  'Jadavpur University',
  'Gujarat University',
  'Rajasthan University',
  'Amity University',
] as const;

export const DEGREES = [
  'B.Tech',
  'B.E.',
  'BCA',
  'MCA',
  'MBA',
  'B.Com',
  'M.Com',
  'BBA',
  'B.Sc',
  'M.Sc',
] as const;

import type { CompanySize } from '../../constants/enums';
import { slugify } from '../../utils/slug';

export interface CompanySeedDef {
  name: string;
  industry: string;
  companySize: CompanySize;
  website: string;
  headquarters: string;
  foundedYear: number;
  description: string;
  locations: string[];
}

export const COMPANY_DEFS: CompanySeedDef[] = [
  {
    name: 'Nimbus Softworks',
    industry: 'IT Services',
    companySize: '201-500',
    website: 'https://nimbus-softworks.example',
    headquarters: 'Bengaluru',
    foundedYear: 2012,
    description:
      'Nimbus Softworks builds cloud-native products and custom software for mid-market clients across India.',
    locations: ['Bengaluru', 'Hyderabad', 'Pune'],
  },
  {
    name: 'PayOrbit Fintech',
    industry: 'FinTech',
    companySize: '51-200',
    website: 'https://payorbit.example',
    headquarters: 'Mumbai',
    foundedYear: 2016,
    description:
      'PayOrbit helps SMEs accept digital payments with simple APIs and merchant dashboards.',
    locations: ['Mumbai', 'Gurugram'],
  },
  {
    name: 'MediCare Connect',
    industry: 'Healthcare',
    companySize: '501-1000',
    website: 'https://medicare-connect.example',
    headquarters: 'Hyderabad',
    foundedYear: 2008,
    description:
      'MediCare Connect operates diagnostic centres and telehealth services for urban and tier-2 cities.',
    locations: ['Hyderabad', 'Chennai', 'Bengaluru'],
  },
  {
    name: 'LearnSphere EdTech',
    industry: 'Education',
    companySize: '51-200',
    website: 'https://learnsphere.example',
    headquarters: 'Delhi',
    foundedYear: 2015,
    description:
      'LearnSphere delivers online upskilling courses for graduates and working professionals.',
    locations: ['Delhi', 'Noida'],
  },
  {
    name: 'CartWave Commerce',
    industry: 'E-commerce',
    companySize: '201-500',
    website: 'https://cartwave.example',
    headquarters: 'Bengaluru',
    foundedYear: 2014,
    description:
      'CartWave is a multi-category marketplace focused on value commerce for Indian shoppers.',
    locations: ['Bengaluru', 'Mumbai', 'Delhi'],
  },
  {
    name: 'TrailBlaze Holidays',
    industry: 'Travel',
    companySize: '11-50',
    website: 'https://trailblaze.example',
    headquarters: 'Jaipur',
    foundedYear: 2017,
    description:
      'TrailBlaze designs curated domestic holiday packages and corporate offsites.',
    locations: ['Jaipur', 'Delhi'],
  },
  {
    name: 'SwiftHaul Logistics',
    industry: 'Logistics',
    companySize: '201-500',
    website: 'https://swifthaul.example',
    headquarters: 'Ahmedabad',
    foundedYear: 2011,
    description:
      'SwiftHaul provides pan-India surface logistics and warehouse fulfilment for D2C brands.',
    locations: ['Ahmedabad', 'Pune', 'Indore'],
  },
  {
    name: 'Habitat Realty Group',
    industry: 'Real Estate',
    companySize: '51-200',
    website: 'https://habitat-realty.example',
    headquarters: 'Gurugram',
    foundedYear: 2009,
    description:
      'Habitat Realty Group advises on commercial leasing and residential projects in NCR.',
    locations: ['Gurugram', 'Noida', 'Delhi'],
  },
  {
    name: 'Pulse Digital Agency',
    industry: 'Digital Marketing',
    companySize: '11-50',
    website: 'https://pulse-digital.example',
    headquarters: 'Mumbai',
    foundedYear: 2018,
    description:
      'Pulse Digital runs performance marketing and brand campaigns for consumer startups.',
    locations: ['Mumbai', 'Bengaluru'],
  },
  {
    name: 'ForgeWorks Manufacturing',
    industry: 'Manufacturing',
    companySize: '501-1000',
    website: 'https://forgeworks.example',
    headquarters: 'Pune',
    foundedYear: 2001,
    description:
      'ForgeWorks manufactures precision automotive components for OEMs across western India.',
    locations: ['Pune', 'Chennai', 'Ahmedabad'],
  },
  {
    name: 'Harbor Inns Hospitality',
    industry: 'Hospitality',
    companySize: '201-500',
    website: 'https://harbor-inns.example',
    headquarters: 'Goa',
    foundedYear: 2005,
    description:
      'Harbor Inns operates boutique hotels and business stays in coastal and metro cities.',
    locations: ['Mumbai', 'Chennai', 'Jaipur'],
  },
  {
    name: 'Apex Contact Centre',
    industry: 'BPO',
    companySize: '1000+',
    website: 'https://apex-contact.example',
    headquarters: 'Noida',
    foundedYear: 2003,
    description:
      'Apex Contact Centre delivers multilingual customer support and back-office services.',
    locations: ['Noida', 'Hyderabad', 'Indore'],
  },
];

export function companySlug(name: string): string {
  return slugify(name);
}

export function allCompanySlugs(): string[] {
  return COMPANY_DEFS.map((c) => companySlug(c.name));
}

import { slugify } from '../../utils/slug';

export interface AreaDef {
  name: string;
  lat?: number;
  lng?: number;
}

export interface CityDef {
  name: string;
  state: string;
  stateCode: string;
  lat: number;
  lng: number;
  areas: AreaDef[];
}

export interface StateDef {
  name: string;
  code: string;
}

export const INDIA_STATES: StateDef[] = [
  { name: 'Delhi', code: 'DL' },
  { name: 'Maharashtra', code: 'MH' },
  { name: 'Karnataka', code: 'KA' },
  { name: 'Telangana', code: 'TG' },
  { name: 'Tamil Nadu', code: 'TN' },
  { name: 'Uttar Pradesh', code: 'UP' },
  { name: 'Haryana', code: 'HR' },
  { name: 'West Bengal', code: 'WB' },
  { name: 'Rajasthan', code: 'RJ' },
  { name: 'Gujarat', code: 'GJ' },
  { name: 'Punjab', code: 'PB' },
  { name: 'Madhya Pradesh', code: 'MP' },
];

export const CITY_DEFS: CityDef[] = [
  {
    name: 'Delhi',
    state: 'Delhi',
    stateCode: 'DL',
    lat: 28.6139,
    lng: 77.209,
    areas: [
      { name: 'Connaught Place', lat: 28.6315, lng: 77.2167 },
      { name: 'Saket', lat: 28.5245, lng: 77.2066 },
      { name: 'Dwarka', lat: 28.5921, lng: 77.046 },
      { name: 'Rohini', lat: 28.7495, lng: 77.0565 },
    ],
  },
  {
    name: 'Mumbai',
    state: 'Maharashtra',
    stateCode: 'MH',
    lat: 19.076,
    lng: 72.8777,
    areas: [
      { name: 'Andheri', lat: 19.1136, lng: 72.8697 },
      { name: 'Bandra', lat: 19.0596, lng: 72.8295 },
      { name: 'Powai', lat: 19.1176, lng: 72.906 },
      { name: 'Lower Parel', lat: 18.9977, lng: 72.837 },
    ],
  },
  {
    name: 'Bengaluru',
    state: 'Karnataka',
    stateCode: 'KA',
    lat: 12.9716,
    lng: 77.5946,
    areas: [
      { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
      { name: 'Whitefield', lat: 12.9698, lng: 77.75 },
      { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
      { name: 'Electronic City', lat: 12.8399, lng: 77.677 },
    ],
  },
  {
    name: 'Hyderabad',
    state: 'Telangana',
    stateCode: 'TG',
    lat: 17.385,
    lng: 78.4867,
    areas: [
      { name: 'Hitech City', lat: 17.4435, lng: 78.3772 },
      { name: 'Gachibowli', lat: 17.44, lng: 78.3489 },
      { name: 'Madhapur', lat: 17.4484, lng: 78.3908 },
    ],
  },
  {
    name: 'Pune',
    state: 'Maharashtra',
    stateCode: 'MH',
    lat: 18.5204,
    lng: 73.8567,
    areas: [
      { name: 'Hinjewadi', lat: 18.5912, lng: 73.7389 },
      { name: 'Kharadi', lat: 18.5515, lng: 73.937 },
      { name: 'Baner', lat: 18.559, lng: 73.7868 },
    ],
  },
  {
    name: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: 'TN',
    lat: 13.0827,
    lng: 80.2707,
    areas: [
      { name: 'OMR', lat: 12.9121, lng: 80.227 },
      { name: 'T Nagar', lat: 13.0418, lng: 80.2341 },
      { name: 'Guindy', lat: 13.0067, lng: 80.2206 },
    ],
  },
  {
    name: 'Gurugram',
    state: 'Haryana',
    stateCode: 'HR',
    lat: 28.4595,
    lng: 77.0266,
    areas: [
      { name: 'Cyber City', lat: 28.495, lng: 77.089 },
      { name: 'Sector 29', lat: 28.468, lng: 77.068 },
      { name: 'Golf Course Road', lat: 28.442, lng: 77.101 },
    ],
  },
  {
    name: 'Noida',
    state: 'Uttar Pradesh',
    stateCode: 'UP',
    lat: 28.5355,
    lng: 77.391,
    areas: [
      { name: 'Sector 62', lat: 28.627, lng: 77.372 },
      { name: 'Sector 18', lat: 28.57, lng: 77.321 },
      { name: 'Sector 137', lat: 28.505, lng: 77.41 },
    ],
  },
  {
    name: 'Kolkata',
    state: 'West Bengal',
    stateCode: 'WB',
    lat: 22.5726,
    lng: 88.3639,
    areas: [
      { name: 'Salt Lake', lat: 22.572, lng: 88.433 },
      { name: 'Park Street', lat: 22.553, lng: 88.352 },
    ],
  },
  {
    name: 'Jaipur',
    state: 'Rajasthan',
    stateCode: 'RJ',
    lat: 26.9124,
    lng: 75.7873,
    areas: [
      { name: 'Malviya Nagar', lat: 26.854, lng: 75.805 },
      { name: 'Vaishali Nagar', lat: 26.912, lng: 75.74 },
    ],
  },
  {
    name: 'Ahmedabad',
    state: 'Gujarat',
    stateCode: 'GJ',
    lat: 23.0225,
    lng: 72.5714,
    areas: [
      { name: 'SG Highway', lat: 23.04, lng: 72.51 },
      { name: 'Navrangpura', lat: 23.036, lng: 72.561 },
    ],
  },
  {
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    stateCode: 'UP',
    lat: 26.8467,
    lng: 80.9462,
    areas: [
      { name: 'Gomti Nagar', lat: 26.85, lng: 81.0 },
      { name: 'Hazratganj', lat: 26.85, lng: 80.95 },
    ],
  },
  {
    name: 'Chandigarh',
    state: 'Punjab',
    stateCode: 'PB',
    lat: 30.7333,
    lng: 76.7794,
    areas: [
      { name: 'Sector 17', lat: 30.741, lng: 76.778 },
      { name: 'Industrial Area', lat: 30.705, lng: 76.801 },
    ],
  },
  {
    name: 'Indore',
    state: 'Madhya Pradesh',
    stateCode: 'MP',
    lat: 22.7196,
    lng: 75.8577,
    areas: [
      { name: 'Vijay Nagar', lat: 22.753, lng: 75.894 },
      { name: 'Palasia', lat: 22.72, lng: 75.88 },
    ],
  },
  {
    name: 'Thane',
    state: 'Maharashtra',
    stateCode: 'MH',
    lat: 19.2183,
    lng: 72.9781,
    areas: [{ name: 'Ghodbunder Road', lat: 19.25, lng: 72.97 }],
  },
];

/** Small international set for hierarchy demos. */
export const UAE_CITIES: CityDef[] = [
  {
    name: 'Dubai',
    state: 'Dubai',
    stateCode: 'DU',
    lat: 25.2048,
    lng: 55.2708,
    areas: [
      { name: 'Business Bay', lat: 25.185, lng: 55.274 },
      { name: 'Dubai Internet City', lat: 25.098, lng: 55.163 },
    ],
  },
];

export function locationSlug(parts: string[]): string {
  return slugify(parts.join(' '));
}

export function allLocationSlugs(): string[] {
  const slugs = new Set<string>();
  slugs.add(locationSlug(['India']));
  slugs.add(locationSlug(['United Arab Emirates']));
  for (const s of INDIA_STATES) {
    slugs.add(locationSlug(['India', s.name]));
  }
  slugs.add(locationSlug(['United Arab Emirates', 'Dubai']));
  for (const city of [...CITY_DEFS, ...UAE_CITIES]) {
    const country = city.stateCode === 'DU' ? 'United Arab Emirates' : 'India';
    slugs.add(locationSlug([country, city.state, city.name]));
    for (const area of city.areas) {
      slugs.add(locationSlug([country, city.state, city.name, area.name]));
    }
  }
  return [...slugs];
}

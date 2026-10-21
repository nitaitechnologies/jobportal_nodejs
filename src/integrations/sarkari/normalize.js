const JOB_TERMS = /\b(job|jobs|recruitment|vacanc(?:y|ies)|apply online|online form|notification|apprentice|appointment|staff nurse|constable|officer|teacher|engineer|clerk|group\s*[abcdi]|bharti|rojgar|sarkari naukri|online correction|edit form)\b/i;
const NON_JOB_TERMS = /\b(result|admit card|answer key|syllabus|exam date|entrance exam|admission|scholarship|counselling|counseling|certificate|important notice)\b/i;

const CATEGORY_PATHS = new Set([
  '',
  'latestjob',
  'result',
  'admitcard',
  'admission',
  'syllabus',
  'answerkey',
  'scholarship',
  'about-us',
  'contact-us',
  'terms-and-conditions',
  'privacy-policy'
]);

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function isJobListing(title) {
  const normalized = cleanText(title);
  if (normalized.length < 8) return false;
  if (/^government jobs$/i.test(normalized) || /^latest jobs?$/i.test(normalized)) return false;
  return JOB_TERMS.test(normalized) && !NON_JOB_TERMS.test(normalized);
}

function canonicalizeUrl(url) {
  return String(url).replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
}

function isDetailJobUrl(url, sourceUrl) {
  let absolute;
  try {
    absolute = new URL(url, sourceUrl);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(absolute.protocol)) return false;
  const sourceOrigin = new URL(sourceUrl).origin;
  if (absolute.origin !== sourceOrigin) return false;

  const parts = absolute.pathname.split('/').filter(Boolean).map((p) => p.toLowerCase());
  if (parts.length < 2) return false;
  if (CATEGORY_PATHS.has(parts[0]) && parts.length === 1) return false;
  if (CATEGORY_PATHS.has(parts.join('/'))) return false;
  return true;
}

function emptyJobDetails() {
  return {
    department: null,
    board: null,
    postName: null,
    notificationNumber: null,
    notificationDate: null,
    applicationStartDate: null,
    applicationLastDate: null,
    feeLastDate: null,
    examDate: null,
    admitCardDate: null,
    totalVacancies: null,
    categoryWiseVacancies: null,
    postWiseVacancies: null,
    location: null,
    eligibility: {
      education: null,
      minAge: null,
      maxAge: null,
      ageRelaxation: null,
      experience: null,
      nationality: null
    },
    applicationFee: null,
    paymentMode: null,
    selectionProcess: null,
    salary: null,
    documentsRequired: null,
    applicationSteps: null,
    notificationPdfUrl: null,
    applyOnlineUrl: null,
    shortInformation: null,
    listingDate: null
  };
}

function normalizeListing({ title, url, sourceUrl, listingDate = null }) {
  const normalizedTitle = cleanText(title);
  let absoluteUrl;
  try {
    absoluteUrl = new URL(url, sourceUrl).href;
  } catch {
    return null;
  }
  if (!isDetailJobUrl(absoluteUrl, sourceUrl)) return null;

  return {
    id: canonicalizeUrl(absoluteUrl),
    title: normalizedTitle,
    url: absoluteUrl,
    sourceUrl: absoluteUrl,
    source: new URL(sourceUrl).origin,
    listingDate: listingDate ? cleanText(listingDate) : null,
    publishedAt: null,
    lastVerifiedAt: null,
    ...emptyJobDetails()
  };
}

function nullIfEmpty(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.length ? value : null;
  const text = cleanText(value);
  return text || null;
}

module.exports = {
  cleanText,
  isJobListing,
  isDetailJobUrl,
  canonicalizeUrl,
  normalizeListing,
  emptyJobDetails,
  nullIfEmpty
};

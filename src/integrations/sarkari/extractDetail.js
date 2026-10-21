const { cleanText, nullIfEmpty } = require('./normalize');

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
};

const DATE_TOKEN = String.raw`(?:[0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})`;

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return cleanText(match[1]);
  }
  return null;
}

function parseLooseDate(value) {
  const text = cleanText(value);
  if (!text) return null;

  const dmy = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const date = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const named = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month != null) {
      const date = new Date(Date.UTC(Number(named[3]), month, Number(named[1])));
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  return null;
}

function tablePairs($) {
  const pairs = [];
  $('table tr').each((_, row) => {
    const cells = $(row).find('th,td').map((__, cell) => cleanText($(cell).text())).get().filter(Boolean);
    if (cells.length >= 2) pairs.push([cells[0], cells.slice(1).join(' | ')]);
    else if (cells.length === 1 && cells[0].includes(':')) {
      const idx = cells[0].indexOf(':');
      pairs.push([cells[0].slice(0, idx).trim(), cells[0].slice(idx + 1).trim()]);
    }
  });
  return pairs;
}

function findPair(pairs, labelRegex) {
  for (const [label, value] of pairs) {
    if (labelRegex.test(label)) return nullIfEmpty(value);
  }
  return null;
}

function extractLinks($, pageUrl) {
  let notificationPdfUrl = null;
  let applyOnlineUrl = null;
  const origin = new URL(pageUrl).origin;

  $('a[href]').each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr('href');
    const label = cleanText(anchor.text());
    if (!href || href.startsWith('#') || /^(javascript:|mailto:|tel:)/i.test(href)) return;

    let absolute;
    try {
      absolute = new URL(href, pageUrl).href;
    } catch {
      return;
    }

    if (!notificationPdfUrl && /\.pdf(\?|$)/i.test(absolute)) {
      notificationPdfUrl = absolute;
    }

    if (
      !applyOnlineUrl &&
      /(apply online|official website|^click here$)/i.test(label) &&
      !/\.pdf(\?|$)/i.test(absolute) &&
      !/sarkariresult\.com|instagram|facebook|twitter|youtube|whatsapp|telegram|threads/i.test(absolute)
    ) {
      applyOnlineUrl = absolute;
    }

    if (
      !applyOnlineUrl &&
      /(?:nic\.in|gov\.in|joinindianarmy)/i.test(absolute) &&
      !absolute.startsWith(origin) &&
      !/\.pdf(\?|$)/i.test(absolute)
    ) {
      applyOnlineUrl = absolute;
    }
  });

  return { notificationPdfUrl, applyOnlineUrl };
}

function extractSelectionProcess(text) {
  const chunk = firstMatch(text, [
    /selection (?:process|procedure)\s*[:\-]?\s*(.{10,220}?)(?:salary|pay scale|important|how to apply|vacancy|application fee|$)/i
  ]);
  if (!chunk) return null;
  const steps = chunk
    .split(/[,|•]|\band\b/i)
    .map(cleanText)
    .filter((s) => s.length > 2 && s.length < 80);
  return steps.length ? [...new Set(steps)].slice(0, 12) : nullIfEmpty(chunk);
}

function clip(value, max = 280) {
  const text = nullIfEmpty(value);
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function extractDetailFields($, pageUrl) {
  const pairs = tablePairs($);
  const bodyText = cleanText($('body').text());
  const links = extractLinks($, pageUrl);

  const postName = clip(
    findPair(pairs, /name\s*of\s*post/i) ||
      firstMatch(bodyText, [/Name Of Post\s*:\s*(.+?)(?:Post Date|Short Information|$)/i]),
    180
  );

  const listingDate = clip(
    findPair(pairs, /post\s*date|update/i) ||
      firstMatch(bodyText, [/Post Date\s*\/\s*Update\s*:\s*([^|]+?)(?:Short Information|$)/i]),
    80
  );

  const shortInformation = clip(
    findPair(pairs, /short\s*information/i) ||
      firstMatch(bodyText, [/Short Information\s*(.+?)(?:Important Dates|Application Begin|$)/i]),
    500
  );

  const applicationStartDate = firstMatch(bodyText, [
    new RegExp(String.raw`Application Begin\s*:\s*(${DATE_TOKEN})`, 'i'),
    new RegExp(String.raw`Apply Online From\s*:\s*(${DATE_TOKEN})`, 'i')
  ]);

  const applicationLastDate = firstMatch(bodyText, [
    new RegExp(String.raw`Last Date(?: for)?(?: Apply Online)?\s*:\s*(${DATE_TOKEN})`, 'i'),
    new RegExp(String.raw`Last Date Complete Form\s*:\s*(${DATE_TOKEN})`, 'i')
  ]);

  const feeLastDate = firstMatch(bodyText, [
    new RegExp(String.raw`(?:Fee Payment Last Date|Last Date(?: for)?(?: Pay(?:ment)?|Pay)\s*(?:Exam\s*)?Fee)\s*:\s*(${DATE_TOKEN})`, 'i')
  ]);

  const examDate = firstMatch(bodyText, [
    new RegExp(String.raw`Exam(?:ination)? Date\s*:\s*(${DATE_TOKEN}|[A-Za-z][^\n|]{0,40})`, 'i')
  ]);

  const admitCardDate = firstMatch(bodyText, [
    new RegExp(String.raw`Admit Card\s*(?:Date|Available)?\s*:\s*(${DATE_TOKEN}|[A-Za-z][^\n|]{0,40})`, 'i')
  ]);

  const notificationDate =
    firstMatch(bodyText, [new RegExp(String.raw`Notification Date\s*:\s*(${DATE_TOKEN})`, 'i')]) ||
    listingDate;

  const totalVacanciesRaw = firstMatch(bodyText, [
    /Total Post\s*:?\s*([0-9]{1,6})/i,
    /Total\s*:\s*([0-9]{1,6})\s*Post/i,
    /Total Vacanc(?:y|ies)\s*:?\s*([0-9]{1,6})/i
  ]);
  const totalVacancies = totalVacanciesRaw ? Number(totalVacanciesRaw) : null;

  const minAge = firstMatch(bodyText, [/Minimum Age\s*:\s*([0-9]{1,2}\s*Years?)/i]);
  const maxAge = firstMatch(bodyText, [/Maximum Age\s*:\s*([0-9]{1,2}\s*Years?)/i]);
  const ageRelaxation = clip(firstMatch(bodyText, [/Age Relaxation\s*:?\s*([^.|]{8,120})/i]), 160);

  const education = clip(
    firstMatch(bodyText, [
      /(?:Educational Qualification|Eligibility)\s*((?:Only|Passed|Bachelor|Master|Graduate|Unmarried|Candidate|12th|10th|Diploma|Degree|B\.|M\.).{5,220}?)(?:Age Limit|Minimum Age|Vacancy Details|Application Fee|$)/i
    ]),
    320
  );

  const applicationFee = clip(
    firstMatch(bodyText, [
      /Application Fee\s*(.+?)(?:Eligibility|Age Limit|Vacancy Details|Important Dates|Only Unmarried|Indian Army|$)/i
    ]),
    220
  );

  const salary = clip(
    firstMatch(bodyText, [/(?:Pay Scale|Salary|Grade Pay)\s*:?\s*([^\n|.]{5,100})/i]),
    120
  );

  const department = clip(
    firstMatch(bodyText, [/(?:Department|Ministry|Organisation|Organization)\s*:?\s*([^\n|.]{3,80})/i]),
    100
  );

  const board =
    firstMatch(bodyText, [
      /\b((?:UPSC|SSC|RRB|IBPS|UPPSC|UPSSSC|UPESSC|BPSC|MPPSC|Join Indian Army)[A-Za-z0-9 /()]{0,40})/i
    ]) || nullIfEmpty(department);

  const location = clip(
    firstMatch(bodyText, [/\b(?:State|Location|Job Location)\s*:?\s*([^\n|.]{2,60})/i]),
    80
  );
  const experience = clip(firstMatch(bodyText, [/\bExperience\s*:?\s*([^\n|.]{3,100})/i]), 120);
  const nationality = clip(firstMatch(bodyText, [/\bNationality\s*:?\s*([^\n|.]{2,60})/i]), 80);
  const notificationNumber = clip(
    firstMatch(bodyText, [/\b(?:Advt|Advertisement|Notification)\s*(?:No\.?|Number)\s*:?\s*([A-Za-z0-9\/\- ]{2,40})/i]),
    60
  );
  const paymentMode = clip(
    firstMatch(bodyText, [/\b(?:Payment Mode|Pay the Exam Fee Through)\s*:?\s*([^\n|.]{5,100})/i]),
    120
  );
  const documentsRequired = clip(
    firstMatch(bodyText, [/\b(?:Documents? Required|Required Documents?)\s*:?\s*([^\n|.]{10,180})/i]),
    200
  );
  const applicationSteps = clip(
    firstMatch(bodyText, [/\bHow to (?:Fill|Apply)[^.]*\.\s*(.{20,260}?)(?:Interested Candidates|Some Useful|Download the|$)/i]),
    280
  );

  const postWiseVacancies = [];
  $('table').each((_, table) => {
    const rows = $(table).find('tr');
    rows.each((index, row) => {
      if (index === 0) return;
      const cells = $(row).find('th,td').map((__, cell) => cleanText($(cell).text())).get();
      if (cells.length >= 2 && /^\d+$/.test(cells[cells.length - 1]) && !/^total$/i.test(cells[0])) {
        postWiseVacancies.push({ post: cells[0], vacancies: Number(cells[cells.length - 1]) });
      }
    });
  });

  const publishedIso = parseLooseDate(listingDate) || parseLooseDate(notificationDate);

  return {
    department: nullIfEmpty(department),
    board: nullIfEmpty(board),
    postName: nullIfEmpty(postName),
    notificationNumber: nullIfEmpty(notificationNumber),
    notificationDate: nullIfEmpty(notificationDate),
    applicationStartDate: nullIfEmpty(applicationStartDate),
    applicationLastDate: nullIfEmpty(applicationLastDate),
    feeLastDate: nullIfEmpty(feeLastDate),
    examDate: nullIfEmpty(examDate),
    admitCardDate: nullIfEmpty(admitCardDate),
    totalVacancies: Number.isFinite(totalVacancies) ? totalVacancies : null,
    categoryWiseVacancies: null,
    postWiseVacancies: postWiseVacancies.length ? postWiseVacancies.slice(0, 40) : null,
    location: nullIfEmpty(location),
    eligibility: {
      education: nullIfEmpty(education),
      minAge: nullIfEmpty(minAge),
      maxAge: nullIfEmpty(maxAge),
      ageRelaxation: nullIfEmpty(ageRelaxation),
      experience: nullIfEmpty(experience),
      nationality: nullIfEmpty(nationality)
    },
    applicationFee: nullIfEmpty(applicationFee),
    paymentMode: nullIfEmpty(paymentMode),
    selectionProcess: extractSelectionProcess(bodyText),
    salary: nullIfEmpty(salary),
    documentsRequired: nullIfEmpty(documentsRequired),
    applicationSteps: nullIfEmpty(applicationSteps),
    notificationPdfUrl: links.notificationPdfUrl,
    applyOnlineUrl: links.applyOnlineUrl,
    shortInformation: nullIfEmpty(shortInformation),
    listingDate: nullIfEmpty(listingDate),
    publishedAt: publishedIso
  };
}

module.exports = { extractDetailFields, parseLooseDate };

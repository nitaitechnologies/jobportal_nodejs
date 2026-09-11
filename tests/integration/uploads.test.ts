import {
  api,
  createAndLoginCandidate,
  createAndLoginEmployer,
  expectErrorShape,
} from '../helpers';

function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

function tinyPdf() {
  return Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8');
}

describe('File uploads', () => {
  it('uploads candidate avatar and rejects dangerous extension', async () => {
    const candidate = await createAndLoginCandidate();

    const bad = await api()
      .post('/api/v1/candidate/profile/avatar')
      .set(candidate.header)
      .attach('file', tinyPng(), 'evil.svg');
    expect(bad.body.success).toBe(false);

    const ok = await api()
      .post('/api/v1/candidate/profile/avatar')
      .set(candidate.header)
      .attach('file', tinyPng(), 'avatar.png');
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
  });

  it('uploads resume and allows owner download only', async () => {
    const candidate = await createAndLoginCandidate();
    const other = await createAndLoginCandidate();

    const upload = await api()
      .post('/api/v1/candidate/profile/resume')
      .set(candidate.header)
      .attach('file', tinyPdf(), 'resume.pdf');
    expect(upload.status).toBe(200);

    const download = await api()
      .get('/api/v1/candidate/profile/resume/download')
      .set(candidate.header);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toMatch(/pdf|octet-stream/);

    const stolen = await api()
      .get('/api/v1/candidate/profile/resume/download')
      .set(other.header);
    expect([404, 400]).toContain(stolen.status);
  });

  it('employer can upload company logo', async () => {
    const employer = await createAndLoginEmployer();
    const res = await api()
      .post('/api/v1/employer/company/logo')
      .set(employer.header)
      .attach('file', tinyPng(), 'logo.png');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects unauthenticated upload', async () => {
    await expectErrorShape(
      await api().post('/api/v1/candidate/profile/avatar').attach('file', tinyPng(), 'a.png'),
      401,
    );
  });
});

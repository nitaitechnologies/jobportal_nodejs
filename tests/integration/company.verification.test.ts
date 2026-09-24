import path from 'path';
import fs from 'fs';
import { api, createAndLoginEmployer, createAndLoginAdmin } from '../helpers';

/** Minimal valid 1x1 PNG for image upload tests. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Employer company verification (176-177)', () => {
  it('saves PAN/GST, uploads documents, and exposes status to admin', async () => {
    const employer = await createAndLoginEmployer();
    const admin = await createAndLoginAdmin();

    const details = await api()
      .patch('/api/v1/employer/company/verification')
      .set(employer.header)
      .send({
        pan: 'ABCDE1234F',
        gstin: '29ABCDE1234F1Z5',
      });
    expect(details.status).toBe(200);
    expect(details.body.data.hasPan).toBe(true);
    expect(details.body.data.hasGstin).toBe(true);
    expect(details.body.data.pan).toMatch(/^AB\*+4F$/);
    expect(details.body.data.verificationStatus).toBe('pending');

    const tmp = path.join('/tmp', `company-kyc-${Date.now()}.png`);
    fs.writeFileSync(tmp, TINY_PNG);

    const upload = await api()
      .post('/api/v1/employer/company/verification/documents')
      .set(employer.header)
      .field('type', 'pan')
      .attach('file', tmp);
    fs.unlinkSync(tmp);

    expect(upload.status).toBe(200);
    expect(upload.body.data.type).toBe('pan');
    expect(upload.body.data.verification.documents.some((d: { type: string }) => d.type === 'pan')).toBe(
      true,
    );

    const status = await api().get('/api/v1/employer/company/verification').set(employer.header);
    expect(status.status).toBe(200);
    expect(status.body.data.documents.length).toBeGreaterThanOrEqual(1);

    const owned = await api().get('/api/v1/employer/company').set(employer.header);
    expect(owned.status).toBe(200);
    expect(owned.body.data.company.hasPan).toBe(true);
    expect(owned.body.data.company.documents[0].hasFile).toBe(true);
    // Never leak raw PAN on owned company summary
    expect(owned.body.data.company.pan).toBeUndefined();

    const companyId = owned.body.data.company.id as string;
    const adminDetail = await api().get(`/api/v1/admin/companies/${companyId}`).set(admin.header);
    expect(adminDetail.status).toBe(200);
    expect(adminDetail.body.data.company.pan).toBe('ABCDE1234F');
    expect(adminDetail.body.data.company.gstin).toBe('29ABCDE1234F1Z5');
    expect(adminDetail.body.data.company.documents.length).toBeGreaterThanOrEqual(1);
    expect(adminDetail.body.data.company.documents[0].hasFile).toBe(true);
    expect(adminDetail.body.data.company.documents[0].downloadUrl).toContain(
      `/admin/companies/${companyId}/documents/pan/download`,
    );
    // Never leak private media refs to admin JSON
    expect(adminDetail.body.data.company.documents[0].mediaUrl).toBeUndefined();

    const download = await api()
      .get(`/api/v1/admin/companies/${companyId}/documents/pan/download`)
      .set(admin.header)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on('data', (chunk: Buffer) => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toMatch(/image\/png|application\/octet-stream/);
    expect(Buffer.isBuffer(download.body) ? download.body.length : 0).toBeGreaterThan(0);

    const approve = await api()
      .patch(`/api/v1/admin/companies/${companyId}/verification`)
      .set(admin.header)
      .send({ action: 'approve' });
    expect(approve.status).toBe(200);
    expect(approve.body.data.company.verificationStatus).toBe('verified');
    expect(approve.body.data.company.documents[0].status).toBe('verified');

    const after = await api().get('/api/v1/employer/company/verification').set(employer.header);
    expect(after.body.data.verificationStatus).toBe('verified');
    expect(after.body.data.verifiedBadge).toBe(true);
  });

  it('rejects invalid PAN/GST and missing document type', async () => {
    const employer = await createAndLoginEmployer();

    const badPan = await api()
      .patch('/api/v1/employer/company/verification')
      .set(employer.header)
      .send({ pan: 'NOTAPAN' });
    expect(badPan.status).toBe(400);

    const badGst = await api()
      .patch('/api/v1/employer/company/verification')
      .set(employer.header)
      .send({ gstin: '123' });
    expect(badGst.status).toBe(400);

    const noType = await api()
      .post('/api/v1/employer/company/verification/documents')
      .set(employer.header)
      .attach('file', Buffer.from('not-a-real-file'), 'x.txt');
    expect([400, 415, 422]).toContain(noType.status);
  });
});

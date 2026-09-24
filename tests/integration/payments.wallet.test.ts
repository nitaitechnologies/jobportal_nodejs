import {
  api,
  createAndLoginAdmin,
  createAndLoginEmployer,
} from '../helpers';

describe('Employer payments wallet GST refund (359-361, 365)', () => {
  it('checks out subscription + credits, issues invoice, and refunds credits', async () => {
    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();

    const plan = await api()
      .post('/api/v1/admin/subscription-plans')
      .set(admin.header)
      .send({
        name: `Paid Plan ${Date.now()}`,
        slug: `paid-${Date.now()}`,
        price: 1999,
        currency: 'INR',
        billingCycle: 'monthly',
        durationDays: 30,
        features: { featuredJobs: true, candidateContact: true },
        limits: {
          jobPostLimit: 20,
          activeJobLimit: 10,
          featuredJobLimit: 2,
          contactUnlockLimit: 25,
        },
        status: 'active',
      });
    expect(plan.status).toBe(201);
    const planId = (plan.body.data.plan ?? plan.body.data).id as string;

    const packs = await api().get('/api/v1/employer/credit-packs').set(employer.header);
    expect(packs.status).toBe(200);
    expect(packs.body.data.packs.length).toBeGreaterThan(0);
    const packId = packs.body.data.packs[0].id as string;
    const packCredits = packs.body.data.packs[0].credits as number;

    const subCheckout = await api()
      .post('/api/v1/employer/payments/checkout')
      .set(employer.header)
      .send({ kind: 'subscription', planId, autoRenew: true });
    expect(subCheckout.status).toBe(201);
    expect(subCheckout.body.data.payment.status).toBe('pending');
    expect(subCheckout.body.data.payment.taxAmount).toBeGreaterThan(0);

    const subConfirm = await api()
      .post(`/api/v1/employer/payments/${subCheckout.body.data.payment.id}/confirm`)
      .set(employer.header)
      .send({});
    expect(subConfirm.status).toBe(200);
    expect(subConfirm.body.data.payment.status).toBe('succeeded');
    expect(subConfirm.body.data.invoice?.invoiceNumber).toMatch(/^WI-/);
    expect(subConfirm.body.data.subscription?.status).toBe('active');

    const creditCheckout = await api()
      .post('/api/v1/employer/payments/checkout')
      .set(employer.header)
      .send({ kind: 'credits', creditPackId: packId });
    expect(creditCheckout.status).toBe(201);

    const creditConfirm = await api()
      .post(`/api/v1/employer/payments/${creditCheckout.body.data.payment.id}/confirm`)
      .set(employer.header)
      .send({});
    expect(creditConfirm.status).toBe(200);
    expect(creditConfirm.body.data.wallet?.balance).toBe(packCredits);

    const wallet = await api().get('/api/v1/employer/wallet').set(employer.header);
    expect(wallet.status).toBe(200);
    expect(wallet.body.data.wallet.balance).toBe(packCredits);

    const invoices = await api().get('/api/v1/employer/invoices').set(employer.header);
    expect(invoices.status).toBe(200);
    expect(invoices.body.data.invoices.length).toBeGreaterThanOrEqual(2);

    const history = await api().get('/api/v1/employer/payments').set(employer.header);
    expect(history.status).toBe(200);
    expect(history.body.data.payments.length).toBeGreaterThanOrEqual(2);

    const failCheckout = await api()
      .post('/api/v1/employer/payments/checkout')
      .set(employer.header)
      .send({ kind: 'credits', creditPackId: packId });
    expect(failCheckout.status).toBe(201);
    const failed = await api()
      .post(`/api/v1/employer/payments/${failCheckout.body.data.payment.id}/fail`)
      .set(employer.header)
      .send({ reason: 'Simulated decline' });
    expect(failed.status).toBe(200);
    expect(failed.body.data.payment.status).toBe('failed');

    const refund = await api()
      .post(`/api/v1/admin/payments/${creditConfirm.body.data.payment.id}/refund`)
      .set(admin.header)
      .send({ reason: 'Test refund' });
    expect(refund.status).toBe(200);
    expect(refund.body.data.payment.status).toBe('refunded');

    const walletAfter = await api().get('/api/v1/employer/wallet').set(employer.header);
    expect(walletAfter.status).toBe(200);
    expect(walletAfter.body.data.wallet.balance).toBe(0);
  });
});

import { api, createAndLoginEmployer } from '../helpers';

describe('Employer chat unread count (dashboard 188)', () => {
  it('returns unreadCount for employer inbox', async () => {
    const employer = await createAndLoginEmployer();
    const res = await api().get('/api/v1/employer/chat/unread-count').set(employer.header);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.unreadCount).toBe('number');
    expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(0);
  });
});

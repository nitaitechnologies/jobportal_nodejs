import { ROLE_DEFAULT_PERMISSIONS } from '../../constants/permissions';
import { AdminUser } from '../../models/AdminUser';
import { User } from '../../models/User';
import { hashPassword } from '../../utils/password';
import { DEMO_PASSWORD, demoEmail } from '../config';
import { DEMO_ADMIN_ACCOUNTS } from '../data/personas';
import type { SeedContext } from '../types';

export async function seedAdmins(ctx: SeedContext): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const def of DEMO_ADMIN_ACCOUNTS) {
    const email = demoEmail(def.local);
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name: def.name,
          email,
          phone: '',
          passwordHash,
          role: 'admin',
          status: 'active',
          emailVerified: true,
          phoneVerified: false,
          avatar: '',
        },
        $unset: { deletedAt: 1 },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const admin = await AdminUser.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          role: def.role,
          permissions: [...ROLE_DEFAULT_PERMISSIONS[def.role]],
          status: 'active',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    ctx.admins.push({
      userId: user._id,
      email,
      name: def.name,
      role: 'admin',
      adminUserId: admin._id,
      adminRole: def.role,
    });
  }

  ctx.summary.admins = ctx.admins.length;
}

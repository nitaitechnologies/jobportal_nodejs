/**
 * Development-only helper to create an admin account safely.
 *
 * Usage:
 *   npx ts-node scripts/create-dev-admin.ts --email=admin@example.com --password='YourStrongPass1!' --name='Super Admin'
 *
 * Optional:
 *   --role=super_admin|admin|moderator|support  (default: super_admin)
 *
 * Do NOT use hardcoded production credentials.
 * Do NOT commit passwords.
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { ADMIN_ROLES, type AdminRole } from '../src/constants/enums';
import { ALL_PERMISSIONS } from '../src/constants/permissions';
import { AdminUser } from '../src/models/AdminUser';
import { User } from '../src/models/User';
import { hashPassword } from '../src/utils/password';

function readArg(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  if (env.nodeEnv === 'production') {
    throw new Error('Refusing to create admin accounts via this script in production.');
  }

  const email = (readArg('email') ?? '').trim().toLowerCase();
  const password = readArg('password') ?? '';
  const name = (readArg('name') ?? 'WorkIndia Admin').trim();
  const roleArg = (readArg('role') ?? 'super_admin') as AdminRole;

  if (!email || !password) {
    throw new Error('Required: --email=... --password=...');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  if (!ADMIN_ROLES.includes(roleArg)) {
    throw new Error(`Invalid role. Allowed: ${ADMIN_ROLES.join(', ')}`);
  }

  await mongoose.connect(env.mongodbUri);

  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error(`A user with email ${email} already exists.`);
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'admin',
    status: 'active',
    emailVerified: true,
  });

  const adminUser = await AdminUser.create({
    userId: user._id,
    role: roleArg,
    permissions: roleArg === 'super_admin' ? [...ALL_PERMISSIONS] : [],
    status: 'active',
  });

  console.log('[create-dev-admin] Admin created successfully');
  console.log(`  userId:      ${user._id.toString()}`);
  console.log(`  adminUserId: ${adminUser._id.toString()}`);
  console.log(`  email:       ${user.email}`);
  console.log(`  role:        ${adminUser.role}`);
  console.log('Password is stored as bcrypt hash only.');
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[create-dev-admin] Failed:', message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });

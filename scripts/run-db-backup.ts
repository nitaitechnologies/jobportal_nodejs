#!/usr/bin/env ts-node
/**
 * CLI database backup via mongodump (sheet 453).
 * Usage: npm run backup:db
 */
import { backupService } from '../src/services/backup.service';
import type { AuthenticatedAdmin } from '../src/types/auth.types';

async function main() {
  const admin: AuthenticatedAdmin = {
    adminUserId: '000000000000000000000000',
    userId: '000000000000000000000000',
    name: 'system',
    email: 'system@localhost',
    role: 'super_admin',
    permissions: [],
    status: 'active',
  };
  // Skip audit write noise for CLI by calling list after create; create still audits.
  const result = await backupService.create(admin);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

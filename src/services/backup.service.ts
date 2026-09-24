import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { writeAuditSafely } from './audit.service';

const BACKUP_ROOT = path.resolve(process.cwd(), 'storage', 'backups');

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureBackupRoot() {
  await fs.mkdir(BACKUP_ROOT, { recursive: true });
}

export class BackupService {
  async list() {
    await ensureBackupRoot();
    const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true });
    const backups = [];
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.name.endsWith('.archive') && !entry.name.endsWith('.gz')) {
        continue;
      }
      const full = path.join(BACKUP_ROOT, entry.name);
      const stat = await fs.stat(full);
      backups.push({
        name: entry.name,
        path: full,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
        kind: entry.isDirectory() ? 'directory' : 'file',
      });
    }
    backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { backups: backups.slice(0, 50), root: BACKUP_ROOT };
  }

  async create(admin: AuthenticatedAdmin) {
    await ensureBackupRoot();
    const name = `backup-${stamp()}`;
    const targetDir = path.join(BACKUP_ROOT, name);
    await fs.mkdir(targetDir, { recursive: true });

    const mongodump = process.env.MONGODUMP_PATH || 'mongodump';
    const args = [`--uri=${env.mongodbUri}`, `--out=${targetDir}`];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(mongodump, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        reject(
          new AppError(
            `mongodump failed to start (${error.message}). Install MongoDB Database Tools or set MONGODUMP_PATH.`,
            HTTP_STATUS.BAD_REQUEST,
          ),
        );
      });
      child.on('close', (code) => {
        if (code === 0) resolve();
        else {
          reject(
            new AppError(
              `mongodump exited with code ${code}: ${stderr.slice(0, 400) || 'unknown error'}`,
              HTTP_STATUS.BAD_REQUEST,
            ),
          );
        }
      });
    });

    await writeAuditSafely({
      admin,
      action: 'database_backup_created',
      entityType: 'system',
      metadata: { name, path: targetDir },
    });

    const listed = await this.list();
    const created = listed.backups.find((b) => b.name === name) ?? {
      name,
      path: targetDir,
      sizeBytes: 0,
      createdAt: new Date().toISOString(),
      kind: 'directory' as const,
    };

    return {
      backup: created,
      message: 'Database backup created successfully',
    };
  }

  /**
   * Restore from a named dump directory created by `create` (sheet 492).
   * Uses mongorestore --drop against the target URI. Prefer dry-run in staging.
   */
  async restore(
    admin: AuthenticatedAdmin,
    input: { name: string; dryRun?: boolean },
  ) {
    await ensureBackupRoot();
    const safeName = input.name.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeName || safeName !== input.name) {
      throw new AppError('Invalid backup name', HTTP_STATUS.BAD_REQUEST);
    }
    const sourceDir = path.join(BACKUP_ROOT, safeName);
    try {
      const stat = await fs.stat(sourceDir);
      if (!stat.isDirectory()) {
        throw new AppError('Backup is not a directory dump', HTTP_STATUS.BAD_REQUEST);
      }
    } catch {
      throw new AppError('Backup not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.dryRun) {
      await writeAuditSafely({
        admin,
        action: 'database_backup_restore_dry_run',
        entityType: 'system',
        metadata: { name: safeName },
      });
      return {
        restored: false,
        dryRun: true,
        name: safeName,
        message: 'Dry-run OK — backup directory exists and is readable',
      };
    }

    const mongorestore = process.env.MONGORESTORE_PATH || 'mongorestore';
    const args = [`--uri=${env.mongodbUri}`, `--drop`, sourceDir];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(mongorestore, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        reject(
          new AppError(
            `mongorestore failed to start (${error.message}). Install MongoDB Database Tools or set MONGORESTORE_PATH.`,
            HTTP_STATUS.BAD_REQUEST,
          ),
        );
      });
      child.on('close', (code) => {
        if (code === 0) resolve();
        else {
          reject(
            new AppError(
              `mongorestore exited with code ${code}: ${stderr.slice(0, 400) || 'unknown error'}`,
              HTTP_STATUS.BAD_REQUEST,
            ),
          );
        }
      });
    });

    await writeAuditSafely({
      admin,
      action: 'database_backup_restored',
      entityType: 'system',
      metadata: { name: safeName },
    });

    return {
      restored: true,
      dryRun: false,
      name: safeName,
      message: 'Database restored successfully from backup',
    };
  }
}

export const backupService = new BackupService();

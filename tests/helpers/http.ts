import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../src/app';

let app: Application | null = null;

export function getApp(): Application {
  if (!app) {
    app = createApp();
  }
  return app;
}

export function api() {
  return request(getApp());
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@test.local`;
}

export function uniquePhone(): string {
  // Valid 10-digit Indian-style mobile starting with 6-9
  const n = Math.floor(100000000 + Math.random() * 899999999);
  return `9${String(n).slice(0, 9)}`;
}

export async function expectErrorShape(
  res: request.Response,
  status: number,
): Promise<void> {
  expect(res.status).toBe(status);
  expect(res.body).toMatchObject({
    success: false,
    message: expect.any(String),
    errors: expect.any(Array),
  });
  // Field *names* may appear in validation errors (e.g. rejected mass-assignment paths).
  // Ensure secret *values* and stack traces are never leaked.
  expect(res.body).not.toHaveProperty('stack');
  const raw = JSON.stringify(res.body);
  expect(raw).not.toMatch(/mongodb(\+srv)?:\/\//i);
  expect(raw).not.toMatch(/JWT_SECRET/i);
  expect(raw).not.toMatch(/"passwordHash"\s*:\s*"/);
  expect(raw).not.toMatch(/at Object\.|node_modules[/\\]/);
}

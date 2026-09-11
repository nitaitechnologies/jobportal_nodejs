import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';

const uploadRoot = path.join(__dirname, '../.tmp-uploads');

beforeAll(async () => {
  fs.mkdirSync(uploadRoot, { recursive: true });
  await connectDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
  // Best-effort cleanup of test uploads
  fs.rmSync(uploadRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map(async (collection) => {
      await collection.deleteMany({});
    }),
  );
});

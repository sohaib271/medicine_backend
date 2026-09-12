import { MongoMemoryReplSet } from 'mongodb-memory-server';
export default async function setup() {
  const server = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  (
    globalThis as typeof globalThis & { mongoTestServer?: MongoMemoryReplSet }
  ).mongoTestServer = server;
  process.env.MONGODB_URL = server.getUri('medicine_test');
  process.env.JWT_SECRET =
    'isolated-test-secret-never-used-in-production-123456';
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL = 'http://localhost:5173';
}

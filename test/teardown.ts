import type { MongoMemoryReplSet } from 'mongodb-memory-server';
export default async function teardown() {
  await (
    globalThis as typeof globalThis & { mongoTestServer?: MongoMemoryReplSet }
  ).mongoTestServer?.stop();
}

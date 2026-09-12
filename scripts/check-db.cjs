process.loadEnvFile();
const { MongoClient } = require('mongoose').mongo;
async function main() {
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL is missing.');
  const client = new MongoClient(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const hello = await client.db().admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB is reachable but must run as a replica set (or Atlas cluster) for stock transactions.');
    console.log('MongoDB is reachable and supports transactions. No store records were changed.');
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message.includes('replica set') ? error.message : `Database connection check failed (${error.code || error.name}). Check MONGODB_URL, network access, and database permissions.`); process.exitCode = 1; });

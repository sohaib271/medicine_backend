const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { MongoClient } = require('mongoose').mongo;
const workspace = path.resolve(__dirname, '..');
const uri = 'mongodb://127.0.0.1:27018/medicine?replicaSet=medicine-rs';
const direct = 'mongodb://127.0.0.1:27018/?directConnection=true';
async function connect() {
  const client = new MongoClient(direct, { serverSelectionTimeoutMS: 1000 });
  try { await client.connect(); return client; } catch { await client.close(); return null; }
}
async function main() {
  let client = await connect();
  if (!client) {
    const candidates = process.env.MONGOD_PATH ? [process.env.MONGOD_PATH] : process.platform === 'win32' ? (spawnSync('where.exe', ['mongod'], { encoding: 'utf8', windowsHide: true }).stdout ?? '').trim().split(/\r?\n/).filter(Boolean) : ['mongod'];
    const executable = candidates[0];
    if (!executable) throw new Error('mongod was not found. Install MongoDB or set MONGOD_PATH.');
    const data = path.join(workspace, '.data', 'mongo'); fs.mkdirSync(data, { recursive: true });
    const log = path.join(workspace, '.data', 'mongo.log');
    const child = spawn(executable, ['--dbpath', data, '--port', '27018', '--bind_ip', '127.0.0.1', '--replSet', 'medicine-rs', '--logpath', log, '--logappend'], { detached: true, stdio: 'ignore', windowsHide: true });
    let spawnError; child.on('error', error => { spawnError = error; }); child.unref();
    for (let i = 0; i < 20 && !client; i++) { if (spawnError) throw spawnError; await new Promise(resolve => setTimeout(resolve, 500)); client = await connect(); }
    if (!client) throw new Error('Local MongoDB did not start. See medicine_backend/.data/mongo.log.');
  }
  try {
    const hello = await client.db().admin().command({ hello: 1 });
    if (hello.setName && hello.setName !== 'medicine-rs') throw new Error('Port 27018 belongs to another replica set. No changes made.');
    if (!hello.setName) {
      try { await client.db().admin().command({ replSetInitiate: { _id: 'medicine-rs', members: [{ _id: 0, host: '127.0.0.1:27018' }] } }); }
      catch (error) { throw new Error(`Could not initialize the local replica set (${error.codeName || error.name}). Check whether port 27018 belongs to another MongoDB instance.`); }
    }
    let ready = false;
    for (let i = 0; i < 30; i++) { const status = await client.db().admin().command({ hello: 1 }); if (status.isWritablePrimary) { ready = true; break; } await new Promise(resolve => setTimeout(resolve, 500)); }
    if (!ready) throw new Error('Replica set election is still in progress. Run db:local again.');
    if (process.argv.includes('--configure')) {
      const envPath = path.join(workspace, '.env'); const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      const backup = path.join(workspace, '.env.before-local');
      if (content && !fs.existsSync(backup)) fs.writeFileSync(backup, content, { flag: 'wx' });
      const updated = /^MONGODB_URL=.*$/m.test(content) ? content.replace(/^MONGODB_URL=.*$/m, `MONGODB_URL=${uri}`) : `${content}\nMONGODB_URL=${uri}\n`;
      fs.writeFileSync(envPath, updated);
      console.log('App configured for the separate local database. Original .env saved as .env.before-local.');
    }
    console.log(`Local replica set ready: ${uri}`);
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

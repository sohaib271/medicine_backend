// Browser tests only. Always uses a new, disposable database; never the .env database.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { hash } = require('bcryptjs');
const path = require('node:path');
async function main() {
  const server = await MongoMemoryReplSet.create({ binary: { downloadDir: path.resolve(__dirname, '../node_modules/.cache/mongodb-memory-server') }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URL = server.getUri('medicine_browser_test');
  process.env.JWT_SECRET = 'isolated-browser-test-secret-only-123456789';
  process.env.NODE_ENV = 'test'; process.env.FRONTEND_URL = 'http://localhost:5175';
  const { NestFactory } = require('@nestjs/core');
  const { getConnectionToken } = require('@nestjs/mongoose');
  const { AppModule } = require('../dist/app.module');
  const { configureApp } = require('../dist/common/setup');
  const { permissions } = require('../dist/database/schemas');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const stop = async () => { await app.close(); await server.stop(); process.exit(0); };
  // Register test-only teardown before Nest installs its final not-found handler.
  app.getHttpAdapter().get('/__test/shutdown', (_req, res) => { res.json({ stopping: true }); setTimeout(stop, 100); });
  configureApp(app); await app.init();
  const db = app.get(getConnectionToken());
  await Promise.all(Object.values(db.models).map(model => model.init()));
  await db.models.Role.create({ name: 'admin', permissions: [...permissions] });
  await db.models.User.create({ name: 'Test Admin', email: 'admin@test.local', role: 'admin', passwordHash: await hash('test-password-123', 10) });
  await db.models.Product.insertMany([
    { name: 'Panadol', type: 'Tablet', strength: '500 mg', purchasePriceCents: 6000, salePriceCents: 10000, discountType: 'percent', discountValue: 10, stock: 50, alarmLimit: 10 },
    { name: 'Augmentin', type: 'Tablet', strength: '625 mg', purchasePriceCents: 12000, salePriceCents: 16000, discountType: 'fixed', discountValue: 10, stock: 4, alarmLimit: 10 },
    { name: 'Calpol', type: 'Syrup', strength: '120 mg/5 ml', purchasePriceCents: 8000, salePriceCents: 11000, discountType: 'percent', discountValue: 0, stock: 18, alarmLimit: 5 },
  ]);
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  await app.listen(3101, '127.0.0.1');
  console.log('Isolated browser test API ready on port 3101');
}
main().catch(error => { console.error(error.message); process.exit(1); });

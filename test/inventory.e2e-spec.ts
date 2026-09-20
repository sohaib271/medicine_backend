import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/setup';
import { permissions } from '../src/database/schemas';
import { DocumentNumberService } from '../src/database/document-number.service';

interface RecordResult {
  _id: string;
  version: number;
  totalCents: number;
  profitCents: number | null;
  profitEstimated: boolean;
  previousPendingCents: number;
  grandTotalCents: number;
  receivedCents: number;
  remainingCents: number;
  status: string;
  stock: number;
  balanceCents: number;
  statusHistory: unknown[];
}
const read = (res: request.Response) => res.body as RecordResult;
const origin = {
  'X-Requested-With': 'medicine-frontend',
  Origin: 'http://localhost:5173',
};
describe('Medical store API with isolated MongoDB transactions', () => {
  let app: INestApplication<App>;
  let db: Connection;
  let cookie: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get<Connection>(getConnectionToken());
    await Promise.all(Object.values(db.models).map((model) => model.init()));
    await db.models.Role.create({
      name: 'admin',
      permissions: [...permissions],
    });
    await db.models.User.create({
      name: 'Test Admin',
      email: 'admin@test.local',
      passwordHash: await hash('test-password-123', 10),
      role: 'admin',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set(origin)
      .send({ email: 'admin@test.local', password: 'test-password-123' })
      .expect(201);
    cookie = (login.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Max-Age=1728000');
    expect(cookie).toContain('SameSite=Lax');
  });
  beforeEach(async () => {
    await db.models.Expense.deleteMany({});
    await db.models.DeliveryChallan.deleteMany({});
    await db.models.Order.deleteMany({});
    await db.models.Product.deleteMany({});
    await db.models.Customer.deleteMany({});
  });
  afterAll(async () => {
    await app?.close();
  });
  it('allocates unique sequential numbers concurrently and does not reuse deleted numbers', async () => {
    await db.collection('document_counters').deleteMany({});
    await db.models.DeliveryChallan.create({
      challanNumber: 'DC-23',
      requestId: randomUUID(),
      items: [],
      status: 'pending',
      statusUpdatedAt: new Date(),
    });
    const numbers = app.get(DocumentNumberService);
    const issued = await Promise.all(
      Array.from({ length: 8 }, () =>
        numbers.next('DC', db.models.DeliveryChallan.collection.collectionName),
      ),
    );
    expect(new Set(issued).size).toBe(8);
    expect(
      issued.map((value) => Number(value.slice(3))).sort((a, b) => a - b),
    ).toEqual([24, 25, 26, 27, 28, 29, 30, 31]);
    await db.models.DeliveryChallan.deleteMany({});
    expect(
      await numbers.next(
        'DC',
        db.models.DeliveryChallan.collection.collectionName,
      ),
    ).toBe('DC-32');
  });
  it('creates, edits and downloads non-billing delivery challans without changing stock', async () => {
    const medicine = await product(10);
    const payload = {
      requestId: randomUUID(),
      status: 'pending',
      items: [
        {
          name: 'Panadol',
          company: 'Sample Pharma',
          type: 'Tablet',
          packs: 3,
          piecesPerPack: 6,
        },
      ],
    };
    await request(app.getHttpServer()).get('/api/challans').expect(401);
    const created = await request(app.getHttpServer())
      .post('/api/challans')
      .set(origin)
      .set('Cookie', cookie)
      .send(payload)
      .expect(201);
    const id = read(created)._id;
    expect(
      (created.body as { items: { quantity: number }[] }).items[0].quantity,
    ).toBe(18);
    const retry = await request(app.getHttpServer())
      .post('/api/challans')
      .set(origin)
      .set('Cookie', cookie)
      .send(payload)
      .expect(201);
    expect(read(retry)._id).toBe(id);
    await request(app.getHttpServer())
      .put(`/api/challans/${id}`)
      .set(origin)
      .set('Cookie', cookie)
      .send({ items: payload.items, status: 'delivered', version: 0 })
      .expect(200)
      .expect((res) => {
        expect(read(res).status).toBe('delivered');
        expect(read(res).version).toBe(1);
      });
    await request(app.getHttpServer())
      .put(`/api/challans/${id}`)
      .set(origin)
      .set('Cookie', cookie)
      .send({ items: payload.items, status: 'pending', version: 0 })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/api/challans/${id}/pdf`)
      .set('Cookie', cookie)
      .expect(200)
      .expect('Content-Type', /pdf/);
    await request(app.getHttpServer())
      .post('/api/challans')
      .set(origin)
      .set('Cookie', cookie)
      .send({ ...payload, requestId: randomUUID(), amount: 100 })
      .expect(400);
    const storedProduct = (await db.models.Product.findById(
      medicine._id,
    ).lean()) as { stock: number } | null;
    expect(storedProduct?.stock).toBe(10);
    expect(await db.models.Order.countDocuments()).toBe(0);
    expect(await db.models.DeliveryChallan.countDocuments()).toBe(1);
  });
  const product = async (stock = 10) =>
    read(
      await request(app.getHttpServer())
        .post('/api/products')
        .set(origin)
        .set('Cookie', cookie)
        .send({
          name: 'Panadol',
          type: 'Tablet',
          strength: '500 mg',
          purchasePrice: 60,
          salePrice: 100,
          discountType: 'percent',
          discountValue: 10,
          stock,
          alarmLimit: 2,
        })
        .expect(201),
    );
  const customer = async () =>
    read(
      await request(app.getHttpServer())
        .post('/api/customers')
        .set(origin)
        .set('Cookie', cookie)
        .send({
          name: 'Test Customer',
          address: 'Lahore',
          phone: '03000000000',
        })
        .expect(201),
    );
  const create = (data: object) =>
    request(app.getHttpServer())
      .post('/api/orders')
      .set(origin)
      .set('Cookie', cookie)
      .send({ requestId: randomUUID(), receivedAmount: 0, ...data });
  const getCustomer = async (id: string) =>
    read(
      await request(app.getHttpServer())
        .get(`/api/customers/${id}`)
        .set('Cookie', cookie)
        .expect(200),
    );
  const stock = async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .set('Cookie', cookie)
      .expect(200);
    return (res.body as { data: RecordResult[] }).data[0].stock;
  };

  it('deletes products, customers, and delivery challans from active lists', async () => {
    const p = await product();
    const c = await customer();
    const challan = read(
      await request(app.getHttpServer())
        .post('/api/challans')
        .set(origin)
        .set('Cookie', cookie)
        .send({
          requestId: randomUUID(),
          status: 'pending',
          items: [
            {
              name: 'Panadol',
              company: 'Sample',
              type: 'Tablet',
              packs: 1,
              piecesPerPack: 10,
            },
          ],
        })
        .expect(201),
    );
    await request(app.getHttpServer())
      .delete(`/api/products/${p._id}`)
      .set(origin)
      .set('Cookie', cookie)
      .send({ version: p.version })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/customers/${c._id}`)
      .set(origin)
      .set('Cookie', cookie)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/challans/${challan._id}`)
      .set(origin)
      .set('Cookie', cookie)
      .send({ version: challan.version })
      .expect(200);
    for (const path of ['products', 'customers', 'challans']) {
      const result = await request(app.getHttpServer())
        .get(`/api/${path}`)
        .set('Cookie', cookie)
        .expect(200);
      expect((result.body as { total: number }).total).toBe(0);
    }
  });

  it('calculates packed stock, supports pack alarms, and adds arrivals', async () => {
    const created = read(
      await request(app.getHttpServer())
        .post('/api/products')
        .set(origin)
        .set('Cookie', cookie)
        .send({
          name: 'Packed medicine',
          type: 'Tablet',
          strength: '10 mg',
          purchasePrice: 10,
          salePrice: 15,
          discountType: 'percent',
          discountValue: 0,
          packing: 20,
          quantityPerPacking: 6,
          alarmType: 'packing',
          alarmLimit: 30,
        })
        .expect(201),
    );
    expect(created.stock).toBe(120);
    const lowStock = await request(app.getHttpServer())
      .get('/api/products?lowStock=true')
      .set('Cookie', cookie)
      .expect(200);
    expect((lowStock.body as { total: number }).total).toBe(1);
    const updated = read(
      await request(app.getHttpServer())
        .patch(`/api/products/${created._id}/inventory`)
        .set(origin)
        .set('Cookie', cookie)
        .send({ packing: 5, quantityPerPacking: 8, version: created.version })
        .expect(200),
    );
    expect(updated.stock).toBe(160);
    expect(updated.version).toBe(1);
    const c = await customer();
    await create({
      customerId: c._id,
      items: [{ productId: created._id, quantity: 2 }],
    }).expect(201);
    expect(await stock()).toBe(144);
    const products = await request(app.getHttpServer())
      .get('/api/products')
      .set('Cookie', cookie)
      .expect(200);
    expect(products.body.data[0]).toMatchObject({
      stockCostCents: 18000,
      packsSold: 2,
      unitsSold: 16,
      salesCents: 3000,
      netProfitCents: 1000,
      profitEstimated: false,
    });
    const dashboard = await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Cookie', cookie)
      .expect(200);
    expect(dashboard.body).toMatchObject({
      stockCostCents: 18000,
      lifetimeSalesCents: 3000,
      soldPacks: 2,
      soldUnits: 16,
      netProfitCents: 1000,
      profitEstimated: false,
    });
  });

  it('removes an inventory adjustment without allowing negative stock', async () => {
    const created = await product(20);
    const updated = read(
      await request(app.getHttpServer())
        .patch(`/api/products/${created._id}/inventory`)
        .set(origin)
        .set('Cookie', cookie)
        .send({
          operation: 'remove',
          packing: 3,
          quantityPerPacking: 2,
          version: created.version,
        })
        .expect(200),
    );
    expect(updated.stock).toBe(14);
    expect(updated.version).toBe(1);

    await request(app.getHttpServer())
      .patch(`/api/products/${created._id}/inventory`)
      .set(origin)
      .set('Cookie', cookie)
      .send({
        operation: 'remove',
        packing: 8,
        quantityPerPacking: 2,
        version: updated.version,
      })
      .expect(409);
    expect(await stock()).toBe(14);
  });

  it('calculates purchase cost for legacy stock without packing data', async () => {
    const created = await product(10);
    await db.models.Product.updateOne(
      { _id: created._id },
      { $unset: { quantityPerPacking: 1 } },
    );
    const dashboard = await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Cookie', cookie)
      .expect(200);
    expect(dashboard.body.stockCostCents).toBe(60000);

    const products = await request(app.getHttpServer())
      .get('/api/products')
      .set('Cookie', cookie)
      .expect(200);
    expect(products.body.data[0].stockCostCents).toBe(60000);
  });

  it('tracks expenses and produces date-range business reports', async () => {
    const date = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Karachi',
    });
    const p = await product(20);
    const c = await customer();
    await create({
      customerId: c._id,
      items: [{ productId: p._id, quantity: 2 }],
    }).expect(201);
    const expense = read(
      await request(app.getHttpServer())
        .post('/api/expenses')
        .set(origin)
        .set('Cookie', cookie)
        .send({
          date,
          category: 'Delivery',
          description: 'Local delivery',
          amountCents: 500,
        })
        .expect(201),
    );
    const report = await request(app.getHttpServer())
      .get(`/api/reports?from=${date}&to=${date}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(report.body.period).toMatchObject({
      packsSold: 2,
      unitsSold: 2,
      salesCents: 18000,
      stockSpentCents: 12000,
      profitCents: 6000,
      expenseCents: 500,
      profitAfterExpenseCents: 5500,
    });
    expect(report.body.lifetime.stockLeftCents).toBe(108000);
    await request(app.getHttpServer())
      .get(`/api/reports/pdf?from=${date}&to=${date}`)
      .set('Cookie', cookie)
      .expect(200)
      .expect('Content-Type', /pdf/);
    await request(app.getHttpServer())
      .delete(`/api/expenses/${expense._id}`)
      .set(origin)
      .set('Cookie', cookie)
      .expect(200);
  });

  it('preserves purchase cost snapshots and labels legacy profit estimates', async () => {
    const p = await product();
    const c = await customer();
    const order = read(
      await create({
        customerId: c._id,
        items: [{ productId: p._id, quantity: 2 }],
      }).expect(201),
    );
    expect(order.profitCents).toBe(-12000);
    await db.models.Product.updateOne(
      { _id: p._id },
      { $set: { purchasePriceCents: 8000 } },
    );
    const updated = read(
      await request(app.getHttpServer())
        .put(`/api/orders/${order._id}`)
        .set(origin)
        .set('Cookie', cookie)
        .send({
          version: 0,
          items: [{ productId: p._id, quantity: 3 }],
          receivedAmount: 0,
        })
        .expect(200),
    );
    expect(updated.profitCents).toBe(-18000);
    const paid = read(
      await request(app.getHttpServer())
        .patch(`/api/orders/${order._id}/payment`)
        .set(origin)
        .set('Cookie', cookie)
        .send({ version: 1, receivedAmount: 210 })
        .expect(200),
    );
    expect(paid.profitCents).toBe(3000);
    const list = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Cookie', cookie)
      .expect(200);
    const saved = (list.body as { data: RecordResult[] }).data[0];
    expect(saved.profitCents).toBe(3000);
    expect(saved.profitEstimated).toBe(false);
    // Simulate an invoice created before purchase costs were saved.
    await db.models.Order.updateOne(
      { _id: order._id },
      { $unset: { 'items.$[].purchasePriceCents': '', profitCents: '' } },
    );
    const legacy = read(
      await request(app.getHttpServer())
        .get(`/api/orders/${order._id}`)
        .set('Cookie', cookie)
        .expect(200),
    );
    expect(legacy.profitCents).toBe(-3000);
    expect(legacy.profitEstimated).toBe(true);
  });
  it('protects API routes and blocks cross-origin mutations', async () => {
    await request(app.getHttpServer()).get('/api/products').expect(401);
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Cookie', cookie)
      .send({ name: 'X' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/customers')
      .set(origin)
      .set('Origin', 'https://untrusted.example')
      .set('Cookie', cookie)
      .send({ name: 'X' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/orders/invalid')
      .set('Cookie', cookie)
      .expect(400);
  });
  it('carries old balances without affecting the current paid status', async () => {
    const p = await product();
    const c = await customer();
    const first = read(
      await create({
        customerId: c._id,
        items: [{ productId: p._id, quantity: 2 }],
        receivedAmount: 50,
      }).expect(201),
    );
    expect(first.totalCents).toBe(18000);
    expect(first.remainingCents).toBe(13000);
    expect(first.status).toBe('partial');
    const second = read(
      await create({
        customerId: c._id,
        items: [{ productId: p._id, quantity: 1 }],
        receivedAmount: 90,
      }).expect(201),
    );
    expect(second.previousPendingCents).toBe(13000);
    expect(second.grandTotalCents).toBe(22000);
    expect(second.status).toBe('paid');
    expect((await getCustomer(c._id)).balanceCents).toBe(13000);
    expect(await stock()).toBe(7);
    const paid = read(
      await request(app.getHttpServer())
        .patch(`/api/orders/${first._id}/payment`)
        .set(origin)
        .set('Cookie', cookie)
        .send({ version: 0, receivedAmount: 180 })
        .expect(200),
    );
    expect(paid.status).toBe('paid');
    expect(paid.statusHistory).toHaveLength(2);
    expect((await getCustomer(c._id)).balanceCents).toBe(0);
  });
  it('supports fixed discounts, editing stock deltas, and deletion rollback', async () => {
    const p = await product();
    const c = await customer();
    const order = read(
      await create({
        customerId: c._id,
        items: [
          {
            productId: p._id,
            quantity: 3,
            discountType: 'fixed',
            discountValue: 20,
          },
        ],
      }).expect(201),
    );
    expect(order.totalCents).toBe(24000);
    expect(await stock()).toBe(7);
    const edited = read(
      await request(app.getHttpServer())
        .put(`/api/orders/${order._id}`)
        .set(origin)
        .set('Cookie', cookie)
        .send({
          version: 0,
          items: [
            {
              productId: p._id,
              quantity: 1,
              discountType: 'fixed',
              discountValue: 20,
            },
          ],
          receivedAmount: 30,
        })
        .expect(200),
    );
    expect(edited.totalCents).toBe(8000);
    expect(edited.remainingCents).toBe(5000);
    expect(await stock()).toBe(9);
    expect((await getCustomer(c._id)).balanceCents).toBe(5000);
    await request(app.getHttpServer())
      .delete(`/api/orders/${order._id}`)
      .set(origin)
      .set('Cookie', cookie)
      .send({ version: 1 })
      .expect(200);
    expect(await stock()).toBe(10);
    expect((await getCustomer(c._id)).balanceCents).toBe(0);
    await request(app.getHttpServer())
      .get(`/api/orders/${order._id}`)
      .set('Cookie', cookie)
      .expect(404);
  });
  it('rolls back the entire transaction if stock is insufficient', async () => {
    const p = await product(1);
    await create({
      customer: { name: 'Should Roll Back', address: '', phone: '' },
      items: [{ productId: p._id, quantity: 2 }],
    })
      .expect(409)
      .expect((response) => {
        expect(response.body).toMatchObject({
          code: 'INSUFFICIENT_STOCK',
          productIds: [p._id],
        });
        expect(response.body.message).toContain('Panadol');
      });
    expect(await stock()).toBe(1);
    expect(await db.models.Customer.countDocuments()).toBe(0);
    expect(await db.models.Order.countDocuments()).toBe(0);
  });
  it('prevents two concurrent orders from overselling the final unit', async () => {
    const p = await product(1);
    const c1 = await customer();
    const c2 = await customer();
    const results = await Promise.all(
      [c1, c2].map((c) =>
        create({
          customerId: c._id,
          items: [{ productId: p._id, quantity: 1 }],
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stock()).toBe(0);
    expect(await db.models.Order.countDocuments({ deletedAt: null })).toBe(1);
  });
  it('rejects stale order and product edits', async () => {
    const p = await product();
    const c = await customer();
    const order = read(
      await create({
        customerId: c._id,
        items: [{ productId: p._id, quantity: 1 }],
      }).expect(201),
    );
    await request(app.getHttpServer())
      .patch(`/api/orders/${order._id}/payment`)
      .set(origin)
      .set('Cookie', cookie)
      .send({ version: 0, receivedAmount: 20 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/orders/${order._id}/payment`)
      .set(origin)
      .set('Cookie', cookie)
      .send({ version: 0, receivedAmount: 90 })
      .expect(409);
    await request(app.getHttpServer())
      .put(`/api/products/${p._id}`)
      .set(origin)
      .set('Cookie', cookie)
      .send({
        version: 0,
        name: 'Panadol',
        type: 'Tablet',
        strength: '500 mg',
        purchasePrice: 60,
        salePrice: 100,
        discountType: 'percent',
        discountValue: 10,
        stock: 100,
        alarmLimit: 2,
      })
      .expect(409);
  });
  it('handles repeated create requests without deducting stock twice', async () => {
    const p = await product();
    const c = await customer();
    const dto = {
      requestId: randomUUID(),
      customerId: c._id,
      items: [{ productId: p._id, quantity: 1 }],
    };
    const first = read(await create(dto).expect(201));
    const second = read(await create(dto).expect(201));
    expect(second._id).toBe(first._id);
    expect(await stock()).toBe(9);
    expect((await getCustomer(c._id)).balanceCents).toBe(9000);
  });
  it('validates quantities, discounts, unknown properties and overpayments', async () => {
    const p = await product();
    const c = await customer();
    await create({
      customerId: c._id,
      items: [{ productId: p._id, quantity: 0 }],
    }).expect(400);
    await create({
      customerId: c._id,
      items: [{ productId: p._id, quantity: 1, discountValue: 101 }],
    }).expect(400);
    await create({
      customerId: c._id,
      items: [{ productId: p._id, quantity: 1 }],
      receivedAmount: 100,
    }).expect(400);
    await create({
      customerId: c._id,
      items: [{ productId: p._id, quantity: 1 }],
      totalCents: 1,
    }).expect(400);
    expect(await stock()).toBe(10);
  });
  it('returns a downloadable PDF and filtered paginated results', async () => {
    const p = await product();
    const c = await customer();
    const order = read(
      await create({
        customerId: c._id,
        items: [{ productId: p._id, quantity: 1 }],
      }).expect(201),
    );
    const pdf = await request(app.getHttpServer())
      .get(`/api/orders/${order._id}/pdf`)
      .set('Cookie', cookie)
      .expect(200)
      .expect('Content-Type', 'application/pdf');
    expect(pdf.headers['content-disposition']).toContain('.pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    const res = await request(app.getHttpServer())
      .get(`/api/orders?customerId=${c._id}&status=pending&limit=1`)
      .set('Cookie', cookie)
      .expect(200);
    expect((res.body as { total: number }).total).toBe(1);
  });
  it('enforces permissions for future roles', async () => {
    await db.models.Role.create({
      name: 'viewer',
      permissions: ['products:read'],
    });
    await db.models.User.create({
      name: 'Viewer',
      email: 'viewer@test.local',
      role: 'viewer',
      passwordHash: await hash('viewer-password-123', 10),
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set(origin)
      .send({ email: 'viewer@test.local', password: 'viewer-password-123' })
      .expect(201);
    const viewerCookie = (
      login.headers['set-cookie'] as unknown as string[]
    )[0];
    await request(app.getHttpServer())
      .get('/api/products')
      .set('Cookie', viewerCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/products')
      .set(origin)
      .set('Cookie', viewerCookie)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set(origin)
      .set('Cookie', viewerCookie)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', viewerCookie)
      .expect(401);
  });
});

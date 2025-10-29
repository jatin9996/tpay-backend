import express from 'express';
import request from 'supertest';
import Notification from '../models/Notification.js';

// In-memory store for stubbing
const store = [];

// Stub model methods
Notification.findAll = async (opts = {}) => {
  // Basic filter support for category and userAddress OR null
  const where = opts.where || {};
  let rows = [...store];
  if (where.category) rows = rows.filter(n => n.category === where.category);
  if (where.read === false) rows = rows.filter(n => !n.read);
  if (where.userAddress) rows = rows.filter(n => n.userAddress === where.userAddress);
  if (where['Op.or']) {
    // Not used in this selftest
  }
  return rows.sort((a,b) => b.createdAt - a.createdAt);
};

Notification.create = async (payload) => {
  const item = {
    id: String(store.length + 1),
    read: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...payload
  };
  store.push(item);
  return item;
};

Notification.findByPk = async (id) => {
  const item = store.find(s => s.id === id);
  if (!item) return null;
  return {
    ...item,
    update: async (fields) => {
      Object.assign(item, fields, { updatedAt: new Date() });
      return item;
    }
  };
};

Notification.update = async (fields, { where }) => {
  let affected = 0;
  store.forEach((n) => {
    const matchCategory = !where.category || n.category === where.category;
    const matchRead = where.read === undefined || n.read === where.read;
    const matchUser = !where.userAddress || n.userAddress === where.userAddress;
    if (matchCategory && matchRead && matchUser) {
      Object.assign(n, fields, { updatedAt: new Date() });
      affected += 1;
    }
  });
  return [affected];
};

Notification.destroy = async ({ where }) => {
  const before = store.length;
  const remain = store.filter((n) => {
    const matchCategory = !where.category || n.category === where.category;
    const matchUser = !where.userAddress || n.userAddress === where.userAddress;
    return !(matchCategory && matchUser);
  });
  store.length = 0;
  store.push(...remain);
  return before - remain.length;
};

// Mount router after stubs
const { default: notificationsRouter } = await import('../routes/notifications.js');

const app = express();
app.use(express.json());
app.use('/notifications', notificationsRouter);

const run = async () => {
  console.log('Running Notifications self-test...');

  // Create items
  await request(app).post('/notifications').send({ category: 'TRANSACTION', severity: 'success', title: 'Swap successful', message: '5 minutes ago', actionLabel: 'View Transaction', actionUrl: 'https://example/tx/0xabc' }).expect(201);
  await request(app).post('/notifications').send({ category: 'GOVERNANCE', severity: 'info', title: 'New governance proposal', message: '10 minutes ago', actionLabel: 'Go to Proposal', actionUrl: 'https://example/gov/1' }).expect(201);
  await request(app).post('/notifications').send({ category: 'SYSTEM', severity: 'warning', title: 'Liquidity pool update', message: 'Yesterday' }).expect(201);

  // List all
  const listAll = await request(app).get('/notifications').query({ tab: 'all' }).expect(200);
  if (!listAll.body.items || listAll.body.items.length !== 3) throw new Error('List all failed');

  // List governance only
  const listGov = await request(app).get('/notifications').query({ tab: 'governance' }).expect(200);
  if (!listGov.body.items.find(n => n.category === 'GOVERNANCE')) throw new Error('Governance filter failed');

  // Mark all transactions as read
  await request(app).post('/notifications/mark-all-read').send({ tab: 'transactions' }).expect(200);

  // Clear all transactions
  await request(app).post('/notifications/clear-all').send({ tab: 'transactions' }).expect(200);

  console.log('Notifications self-test passed.');
};

run().catch((e) => {
  console.error('Self-test failed:', e);
  process.exit(1);
});



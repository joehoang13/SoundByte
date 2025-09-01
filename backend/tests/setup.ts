import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) await c.deleteMany({});
});

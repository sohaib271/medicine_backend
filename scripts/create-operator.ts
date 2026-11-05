import mongoose from 'mongoose';
import { hash } from 'bcryptjs';
import {
  operatorPermissions,
  RoleSchema,
  UserSchema,
} from '../src/database/schemas';

async function main() {
  process.loadEnvFile();
  const name = process.env.OPERATOR_NAME?.trim();
  const email = process.env.OPERATOR_EMAIL?.trim().toLowerCase();
  const password = process.env.OPERATOR_PASSWORD;
  if (!name || !email || !password)
    throw new Error('OPERATOR_NAME, OPERATOR_EMAIL and OPERATOR_PASSWORD are required in .env');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('OPERATOR_EMAIL must be a valid email.');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('OPERATOR_PASSWORD must be between 12 and 72 bytes.');
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL is required in .env');

  await mongoose.connect(process.env.MONGODB_URL);
  const Role = mongoose.model('Role', RoleSchema);
  const User = mongoose.model('User', UserSchema);
  await User.init();
  if (await User.exists({ email })) throw new Error('An account already exists with that email.');
  await Role.updateOne(
    { name: 'operator' },
    { $set: { permissions: [...operatorPermissions] } },
    { upsert: true },
  );
  await User.create({ name, email, passwordHash: await hash(password, 12), role: 'operator' });
  console.log(`Operator created successfully: ${email}`);
}

main()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

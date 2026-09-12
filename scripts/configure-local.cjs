const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const target = path.resolve(__dirname, '../.env');
let content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
const defaults = { JWT_SECRET: crypto.randomBytes(48).toString('hex'), FRONTEND_URL: 'http://localhost:5173', PORT: '3000', NODE_ENV: 'development', STORE_NAME: 'Zainab Traders', CURRENCY: 'PKR', TIMEZONE: 'Asia/Karachi' };
for (const [key, value] of Object.entries(defaults)) if (!new RegExp(`^${key}=`, 'm').test(content)) content += `\n${key}=${value}`;
fs.writeFileSync(target, content.trimEnd() + '\n');
console.log('Missing local defaults configured; existing values preserved.');

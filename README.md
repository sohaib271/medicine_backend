# Medicine backend

NestJS 11 API for medicine inventory, customers, billing, and cookie authentication.

See the [workspace README](../README.md) for the full API, accounting rules, role extension, and deployment instructions.

```powershell
npm.cmd install
npm.cmd run config:local
npm.cmd run db:local
npm.cmd run db:check
npm.cmd run admin:create
npm.cmd run start:dev
```

The configured local replica set uses port 27018 and persists its data in `.data/mongo`. `db:local` starts it after a reboot. To explicitly switch from another database to this local one, use `npm.cmd run db:use-local`; it backs up the original `.env` first. No default admin account is created. `admin:create` prompts for your credentials and hides password input.

Environment configuration is read through Nest ConfigService. `.env.example` lists available settings. API base: `http://localhost:3000/api`.

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
```

Integration tests use an isolated disposable replica set, not the configured store database.

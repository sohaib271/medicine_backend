# Medicine backend

NestJS 11 API for medicine inventory, customers, billing, and cookie authentication.

The API can also serve the built frontend on this PC. It listens only on the loopback interface in local desktop mode.

For MongoDB Atlas, configure `medicine_backend/.env` as described below, then run:

```powershell
npm.cmd install
npm.cmd run db:check
npm.cmd run start:dev
```

To use the optional local MongoDB replica set instead:

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

## Set up MongoDB Atlas on another computer

Create `medicine_backend/.env` on that computer. This file is ignored by Git, so it is not included when you clone or copy the repository through Git. Copy `.env.example` to `.env`, then replace `MONGODB_URL` with the Atlas connection string for your database and set `JWT_SECRET` to a random value of at least 32 characters. Keep `.env` private. The example URL contains placeholders and cannot connect as written.

From the `medicine_backend` folder, run `npm.cmd run db:check` before starting the server. If you get a DNS `querySrv ECONNREFUSED` error, use the standard `mongodb://` multi-host Atlas connection string instead of the `mongodb+srv://` form. Atlas network access must allow the other computer's public IP address.

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
```

Integration tests use an isolated disposable replica set, not the configured store database.

## Run the built app on this PC

MongoDB must be running and `.env` must point to a replica set. `db:check` verifies the connection without changing records. Build both projects after code changes:

```powershell
cd medicine_frontend
npm.cmd run build
cd ..\medicine_backend
npm.cmd run build
npm.cmd run db:check
$env:LOCAL_DESKTOP = 'true'
$env:NODE_ENV = 'production'
npm.cmd run start:prod
```

Open `http://127.0.0.1:3000/login`. Use the account created by `npm.cmd run admin:create` if this is a fresh database. Leave the terminal open while using the app; press Ctrl+C to stop it. Run the commands again after a reboot or code update. The MongoDB service must also be running after a reboot. Do not run `db:use-local` against an existing store unless you intend to switch to its separate empty database.

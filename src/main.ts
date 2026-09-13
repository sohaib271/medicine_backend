import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './common/setup';
import { AppModule } from './app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function bootstrap() {
  const localDesktop = process.env.LOCAL_DESKTOP === 'true';
  const frontend = resolve(__dirname, '../../medicine_frontend/dist');
  if (localDesktop && !existsSync(resolve(frontend, 'index.html')))
    throw new Error(
      'Build the frontend before starting the desktop application.',
    );
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  configureApp(app);
  if (localDesktop) {
    app.useStaticAssets(frontend);
    app.use(
      (
        req: import('express').Request,
        res: import('express').Response,
        next: import('express').NextFunction,
      ) => {
        if (
          (req.method === 'GET' || req.method === 'HEAD') &&
          req.path !== '/api' &&
          !req.path.startsWith('/api/') &&
          req.accepts('html')
        ) {
          res.sendFile(resolve(frontend, 'index.html'));
          return;
        }
        next();
      },
    );
  }
  app.enableShutdownHooks();
  await app.listen(
    config.get<number>('PORT', 3000),
    localDesktop ? '127.0.0.1' : '0.0.0.0',
  );
}
void bootstrap();

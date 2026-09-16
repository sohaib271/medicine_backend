import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const localDesktop = process.env.LOCAL_DESKTOP === 'true';
  const origin = localDesktop
    ? `http://127.0.0.1:${config.get<number>('PORT', 3000)}`
    : config.get<string>('FRONTEND_URL', 'http://127.0.0.1:5173');
  app.setGlobalPrefix('api');
  app.use(
    helmet(
      localDesktop
        ? {
            contentSecurityPolicy: {
              directives: { upgradeInsecureRequests: null },
            },
            strictTransportSecurity: false,
          }
        : {},
    ),
  );
  app.use(cookieParser());
  app.enableCors({ origin, credentials: true });
  // A non-simple header forces cross-origin browsers to preflight every mutation.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (req.get('X-Requested-With') !== 'medicine-frontend' ||
        (req.get('Origin') && req.get('Origin') !== origin))
    ) {
      res.status(403).json({ message: 'Request origin is not allowed.' });
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

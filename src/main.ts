import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './common/setup';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(config.get<number>('PORT', 3000));
}
void bootstrap();

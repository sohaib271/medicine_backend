import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { resolve } from 'node:path';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { CustomersController } from './customers/customers.controller';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { InvoiceService } from './orders/invoice.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { ChallansModule } from './challans/challans.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '../.env'),
      validate: (env: Record<string, unknown>) => {
        if (typeof env.MONGODB_URL !== 'string' || !env.MONGODB_URL)
          throw new Error(
            `MONGODB_URL must be configured in ${resolve(__dirname, '../.env')} or the process environment.`,
          );
        if (typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32)
          throw new Error('JWT_SECRET must be at least 32 characters.');
        if (env.NODE_ENV === 'production' && !env.FRONTEND_URL)
          throw new Error('FRONTEND_URL is required in production.');
        return env;
      },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URL'),
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
      }),
    }),
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 180 }]),
    AuthModule,
    ChallansModule,
  ],
  controllers: [
    ProductsController,
    CustomersController,
    OrdersController,
    DashboardController,
  ],
  providers: [
    ProductsService,
    OrdersService,
    InvoiceService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentNumberService } from './document-number.service';
import {
  CustomerSchema,
  OrderSchema,
  ProductSchema,
  RoleSchema,
  UserSchema,
} from './schemas';

@Global()
@Module({
  providers: [DocumentNumberService],
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Role', schema: RoleSchema },
      { name: 'Product', schema: ProductSchema },
      { name: 'Customer', schema: CustomerSchema },
      { name: 'Order', schema: OrderSchema },
    ]),
  ],
  exports: [MongooseModule, DocumentNumberService],
})
export class DatabaseModule {}

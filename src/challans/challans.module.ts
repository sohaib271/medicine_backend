import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChallanSchema } from './challans.schema';
import { ChallansController } from './challans.controller';
import { ChallansService } from './challans.service';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'DeliveryChallan', schema: ChallanSchema },
    ]),
  ],
  controllers: [ChallansController],
  providers: [ChallansService],
})
export class ChallansModule {}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CustomerDto } from '../customers/customers.dto';
export class OrderItemDto {
  @IsMongoId() productId: string;
  @IsInt() @Min(1) @Max(1000000) quantity: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  salePrice?: number;
  @IsOptional() @IsIn(['percent', 'fixed']) discountType?: 'percent' | 'fixed';
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  discountValue?: number;
}
export class CreateOrderDto {
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDto)
  billingDetails?: CustomerDto;
  @IsUUID() requestId: string;
  @IsOptional() @IsMongoId() customerId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer?: CustomerDto;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000000000)
  receivedAmount: number;
}
export class UpdateOrderDto {
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDto)
  billingDetails?: CustomerDto;
  @IsInt() @Min(0) version: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000000000)
  receivedAmount: number;
}
export class PaymentDto {
  @IsInt() @Min(0) version: number;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000000000)
  receivedAmount: number;
}

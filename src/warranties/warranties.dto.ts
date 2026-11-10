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
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WarrantyItemDto {
  @IsMongoId() productId: string;
  @IsString() @Matches(/\S/, { message: 'batchNumber must not be empty' }) @MaxLength(80)
  batchNumber: string;
  @IsInt() @Min(1) @Max(1000000) quantity: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000000) salePrice: number;
  @IsIn(['percent', 'fixed']) discountType: 'percent' | 'fixed';
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000000) discountValue: number;
}
export class WarrantyDto {
  @IsUUID() requestId: string;
  @IsMongoId() customerId: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => WarrantyItemDto)
  items: WarrantyItemDto[];
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000000000000)
  overallDiscount: number;
  @IsOptional() @IsString() @MaxLength(500) remarks = '';
}

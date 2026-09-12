import {
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { medicineTypes } from '../database/schemas';
export class ProductDto {
  @IsString() @MinLength(1) @MaxLength(150) name: string;
  @IsIn(medicineTypes) type: (typeof medicineTypes)[number];
  @IsString() @MaxLength(60) strength: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  purchasePrice: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000000) salePrice: number;
  @IsIn(['percent', 'fixed']) discountType: 'percent' | 'fixed';
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  discountValue: number;
  @IsInt() @Min(0) @Max(1000000) stock: number;
  @IsInt() @Min(0) @Max(1000000) alarmLimit: number;
}
export class UpdateProductDto extends ProductDto {
  @IsInt() @Min(0) version: number;
}

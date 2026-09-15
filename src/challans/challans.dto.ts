import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { medicineTypes } from '../database/schemas';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class ChallanItemDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) strength?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(150) name: string;
  @IsIn(medicineTypes) type: (typeof medicineTypes)[number];
  @IsInt() @Min(1) @Max(1000000) quantity: number;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(100) company: string;
}
export class ChallanDto {
  @IsOptional() @IsMongoId() customerId?: string;
  @IsOptional() @IsString() @MaxLength(500) customerAddress?: string;
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChallanItemDto)
  items: ChallanItemDto[];
  @IsIn(['pending', 'delivered']) status: 'pending' | 'delivered';
}
export class CreateChallanDto extends ChallanDto {
  @IsUUID() requestId: string;
}
export class UpdateChallanDto extends ChallanDto {
  @IsInt() @Min(0) version: number;
}
export class ChallanQuery {
  @IsOptional() @IsString() @MaxLength(100) search = '';
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
  @IsOptional() @IsIn(['pending', 'delivered']) status?:
    'pending' | 'delivered';
}

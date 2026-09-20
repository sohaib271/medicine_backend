import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ExpenseDto {
  @IsDateString() date: string;
  @IsString() @MaxLength(80) category: string;
  @IsOptional() @IsString() @MaxLength(300) description = '';
  @Type(() => Number) @IsInt() @Min(1) @Max(100000000000) amountCents: number;
}

export class ExpenseQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
}

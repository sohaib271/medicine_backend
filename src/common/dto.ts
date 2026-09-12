import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListQuery {
  @IsOptional() @IsString() @MaxLength(100) search = '';
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
  @IsOptional() @IsIn(['paid', 'partial', 'pending']) status?:
    'paid' | 'partial' | 'pending';
  @IsOptional() @IsMongoId() customerId?: string;
  @IsOptional() @IsIn(['true', 'false']) lowStock?: string;
}
export class VersionDto {
  @IsInt() @Min(0) version: number;
}
export function searchRegex(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}
export function pageResult<T>(data: T[], total: number, query: ListQuery) {
  return {
    data,
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.ceil(total / query.limit),
  };
}

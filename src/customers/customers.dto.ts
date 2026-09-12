import { IsString, MaxLength, MinLength } from 'class-validator';
export class CustomerDto {
  @IsString() @MinLength(1) @MaxLength(150) name: string;
  @IsString() @MaxLength(500) address: string;
  @IsString() @MaxLength(30) phone: string;
}

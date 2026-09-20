import { IsDateString } from 'class-validator';

export class ReportQuery {
  @IsDateString() from: string;
  @IsDateString() to: string;
}

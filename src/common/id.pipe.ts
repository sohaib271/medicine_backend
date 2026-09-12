import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
@Injectable()
export class IdPipe implements PipeTransform<string> {
  transform(value: string) {
    if (!/^[a-f\d]{24}$/i.test(value))
      throw new BadRequestException('Invalid ID.');
    return value;
  }
}

import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.type';

@Injectable()
export class UserIdPipe implements PipeTransform<
  string | number,
  string | number
> {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  transform(value: string | number): string | number {
    if (
      this.configService.get('database.isDocumentDatabase', { infer: true })
    ) {
      if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value))
        return value;
    } else {
      const id = Number(value);
      if (
        /^\d+$/.test(String(value)) &&
        Number.isSafeInteger(id) &&
        id > 0 &&
        id <= 2147483647
      )
        return id;
    }
    throw new BadRequestException('Invalid user ID');
  }
}

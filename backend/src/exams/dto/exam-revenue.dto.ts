import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';
import { HskQueryDto } from '../../utils/dto/content-query.dto';

export class ExamRevenueQueryDto extends HskQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Ngày bắt đầu, giờ Việt Nam. Mặc định đầu tháng hiện tại.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Bao gồm hết ngày kết thúc, tối đa 366 ngày mỗi lần xem.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({
    enum: ['creating', 'pending', 'paid', 'cancelled', 'expired'],
    description:
      'Chỉ lọc bảng giao dịch; không thay đổi số liệu tổng hợp và biểu đồ.',
  })
  @IsOptional()
  @IsIn(['creating', 'pending', 'paid', 'cancelled', 'expired'])
  status?: 'creating' | 'pending' | 'paid' | 'cancelled' | 'expired';
}

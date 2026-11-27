import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class RegistrationsQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Ngày bắt đầu theo giờ Việt Nam; phải gửi cùng ngày kết thúc.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'Ngày bắt đầu không hợp lệ.' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-05',
    description: 'Bao gồm hết ngày kết thúc; tối đa 366 ngày mỗi lần xem.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'Ngày kết thúc không hợp lệ.' })
  to?: string;
}

export class RegistrationsResponseDto {
  @ApiProperty({
    example: 1,
    description: 'The starting month of the 6-month period',
  })
  startMonth: number;

  @ApiProperty({
    example: 6,
    description: 'The ending month of the 6-month period',
  })
  endMonth: number;

  @ApiProperty({
    example: [10, 20, 15, 30, 25, 40],
    type: [Number],
    description:
      'Số người dùng mới theo ngày đã chọn, hoặc theo tháng nếu không lọc ngày.',
  })
  newUsers: number[];

  @ApiProperty({
    example: [2, 1, 0, 3, 1, 5],
    type: [Number],
    description:
      'Số giáo viên mới theo ngày đã chọn, hoặc theo tháng nếu không lọc ngày.',
  })
  newTeachers: number[];

  @ApiPropertyOptional({ example: '2026-11-01' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-05' })
  to?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['2026-11-01', '2026-11-02'],
    description:
      'Các ngày theo đúng thứ tự dữ liệu; ngày không có đăng ký vẫn có giá trị 0.',
  })
  dates?: string[];
}

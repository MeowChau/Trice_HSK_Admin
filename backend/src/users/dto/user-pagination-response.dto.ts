import { ApiProperty } from '@nestjs/swagger';
import { InfinityPaginationResponse } from '../../utils/dto/infinity-pagination-response.dto';
import { User } from '../domain/user';

export class UserPaginationResponseDto extends InfinityPaginationResponse(
  User,
) {
  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 3, minimum: 1 })
  totalPages: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class FileUploadDto {
  @ApiProperty({ example: 'image.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 138723 })
  @IsInt()
  @Min(1)
  fileSize: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SystemConfigDto {
  @ApiProperty()
  @IsString()
  value: string;
}

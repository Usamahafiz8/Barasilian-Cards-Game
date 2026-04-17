import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AppleAuthDto {
  @ApiProperty({ description: 'Apple identity token' })
  @IsString()
  identityToken: string;

  @ApiProperty({ description: 'Apple authorization code' })
  @IsString()
  authorizationCode: string;

  @ApiProperty({ required: false })
  @IsOptional()
  fullName?: { firstName?: string; lastName?: string };
}

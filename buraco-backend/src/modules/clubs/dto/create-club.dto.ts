import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClubMode, ClubType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator';

export class CreateClubDto {
  @ApiProperty({ minLength: 3, maxLength: 30 })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  welcomeMessage?: string;

  @ApiProperty({ enum: ClubMode, default: ClubMode.CLASSIC })
  @IsEnum(ClubMode)
  mode: ClubMode;

  @ApiProperty({ enum: ClubType, default: ClubType.OPEN })
  @IsEnum(ClubType)
  type: ClubType;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minPoints?: number;
}

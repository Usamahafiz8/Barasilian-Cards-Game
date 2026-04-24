import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { MissionType, MissionRequirement } from '@prisma/client';

export class CreateMissionDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: MissionType })
  @IsEnum(MissionType)
  type: MissionType;

  @ApiProperty({ enum: MissionRequirement })
  @IsEnum(MissionRequirement)
  requirement: MissionRequirement;

  @ApiProperty()
  @IsInt()
  @Min(1)
  targetValue: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  rewardCoins?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  rewardDiamonds?: number;
}

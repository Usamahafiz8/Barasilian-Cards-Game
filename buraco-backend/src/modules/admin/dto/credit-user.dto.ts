import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CurrencyType } from '@prisma/client';

export class CreditUserDto {
  @ApiProperty({ enum: CurrencyType })
  @IsEnum(CurrencyType)
  currency: CurrencyType;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

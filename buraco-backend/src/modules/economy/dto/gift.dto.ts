import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsUUID, Min } from 'class-validator';
import { CurrencyType } from '@prisma/client';

export class GiftDto {
  @ApiProperty()
  @IsUUID()
  receiverId: string;

  @ApiProperty({ enum: CurrencyType })
  @IsEnum(CurrencyType)
  currency: CurrencyType;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  amount: number;
}

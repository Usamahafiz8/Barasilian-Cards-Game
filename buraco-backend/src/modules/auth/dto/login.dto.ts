import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'player@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'coolplayer' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'SecurePass123' })
  @IsString()
  password: string;
}

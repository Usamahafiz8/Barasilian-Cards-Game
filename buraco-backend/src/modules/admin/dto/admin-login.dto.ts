import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@buraco.game' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@123!' })
  @IsString()
  @MinLength(6)
  password: string;
}

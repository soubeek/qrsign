import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { GlobalRole } from '@prisma/client';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre' })
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  role?: GlobalRole;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

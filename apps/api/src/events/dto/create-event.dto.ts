import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsString()
  @IsOptional()
  logoEmoji?: string;

  @IsString()
  @IsOptional()
  entitySingular?: string;

  @IsString()
  @IsOptional()
  entityPlural?: string;

  @IsString()
  @IsOptional()
  displayNameTpl?: string;

  @IsArray()
  @IsOptional()
  searchFields?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

import { IsString, IsEnum, IsBoolean, IsOptional, IsArray, IsInt } from 'class-validator';

export class CreateFieldDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsString()
  type: string;

  @IsArray()
  @IsOptional()
  options?: string[];

  @IsBoolean()
  @IsOptional()
  editable?: boolean;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsBoolean()
  @IsOptional()
  displayInList?: boolean;

  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isQrField?: boolean;

  @IsBoolean()
  @IsOptional()
  isEmailField?: boolean;
}

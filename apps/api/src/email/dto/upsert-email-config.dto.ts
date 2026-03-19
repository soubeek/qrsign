import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class UpsertEmailConfigDto {
  @IsString()
  smtpHost: string;

  @IsInt()
  @IsOptional()
  smtpPort?: number;

  @IsBoolean()
  @IsOptional()
  smtpSecure?: boolean;

  @IsString()
  smtpUser: string;

  @IsString()
  @IsOptional()
  smtpPass?: string;

  @IsString()
  fromAddress: string;

  @IsString()
  fromName: string;

  @IsBoolean()
  @IsOptional()
  autoSendOnSign?: boolean;

  @IsBoolean()
  @IsOptional()
  allowManualSend?: boolean;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  bodyTemplate?: string;
}

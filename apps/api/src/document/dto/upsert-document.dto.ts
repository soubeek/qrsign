import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class UpsertDocumentDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() signingLabel?: string;
  @IsString() @IsOptional() declarationTemplate?: string;
  @IsOptional() noticeSections?: any;
  @IsString() @IsOptional() pdfFooterText?: string;
  @IsInt() @IsOptional() signatureWidthMm?: number;
  @IsInt() @IsOptional() signatureHeightMm?: number;
  @IsString() @IsOptional() logoPosition?: string;
  @IsString() @IsOptional() titlePosition?: string;
  @IsInt() @IsOptional() displayOrder?: number;
  @IsBoolean() @IsOptional() required?: boolean;
}

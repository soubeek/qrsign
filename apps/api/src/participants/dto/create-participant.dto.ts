import { IsString, IsObject } from 'class-validator';

export class CreateParticipantDto {
  @IsString()
  qrCode: string;

  @IsObject()
  data: Record<string, any>;
}

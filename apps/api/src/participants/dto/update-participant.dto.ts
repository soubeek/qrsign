import { IsOptional, IsObject } from 'class-validator';

export class UpdateParticipantDto {
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

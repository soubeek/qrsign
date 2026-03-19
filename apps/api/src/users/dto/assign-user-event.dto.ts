import { IsEnum, IsOptional, IsString } from 'class-validator';
import { GlobalRole } from '@prisma/client';

export class AssignUserEventDto {
  @IsString()
  eventId: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  eventRole?: GlobalRole;
}

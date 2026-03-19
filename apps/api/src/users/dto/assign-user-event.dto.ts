import { IsOptional, IsString } from 'class-validator';

export class AssignUserEventDto {
  @IsString()
  eventId: string;

  @IsString()
  @IsOptional()
  eventRole?: string;
}

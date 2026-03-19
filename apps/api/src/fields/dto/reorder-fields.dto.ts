import { IsArray, ValidateNested, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class FieldOrderItem {
  @IsString()
  id: string;

  @IsInt()
  displayOrder: number;
}

export class ReorderFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldOrderItem)
  items: FieldOrderItem[];
}

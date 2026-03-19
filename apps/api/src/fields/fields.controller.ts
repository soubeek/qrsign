import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { FieldsService } from './fields.service';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { ReorderFieldsDto } from './dto/reorder-fields.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('events/:slug/fields')
export class FieldsController {
  constructor(private fieldsService: FieldsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER')
  findAll(@Param('slug') slug: string) {
    return this.fieldsService.findAll(slug);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Param('slug') slug: string, @Body() dto: CreateFieldDto) {
    return this.fieldsService.create(slug, dto);
  }

  @Put(':fieldId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('fieldId') fieldId: string, @Body() dto: UpdateFieldDto) {
    return this.fieldsService.update(fieldId, dto);
  }

  @Delete(':fieldId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  delete(@Param('fieldId') fieldId: string) {
    return this.fieldsService.delete(fieldId);
  }

  @Post('reorder')
  @Roles('SUPER_ADMIN', 'ADMIN')
  reorder(@Param('slug') slug: string, @Body() dto: ReorderFieldsDto) {
    return this.fieldsService.reorder(slug, dto.items);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { FieldType } from '@prisma/client';

@Injectable()
export class FieldsService {
  constructor(private prisma: PrismaService) {}

  async findAll(slug: string) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.fieldDef.findMany({
      where: { eventId: event.id },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async create(slug: string, dto: CreateFieldDto) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.fieldDef.create({
      data: {
        eventId: event.id,
        key: dto.key,
        label: dto.label,
        type: dto.type as FieldType,
        options: dto.options || [],
        editable: dto.editable ?? true,
        required: dto.required ?? false,
        displayInList: dto.displayInList ?? false,
        displayOrder: dto.displayOrder ?? 0,
        isQrField: dto.isQrField ?? false,
        isEmailField: dto.isEmailField ?? false,
      },
    });
  }

  async update(fieldId: string, dto: UpdateFieldDto) {
    const data: any = { ...dto };
    if (dto.type) data.type = dto.type as FieldType;
    return this.prisma.fieldDef.update({
      where: { id: fieldId },
      data,
    });
  }

  async delete(fieldId: string) {
    return this.prisma.fieldDef.delete({ where: { id: fieldId } });
  }

  async reorder(slug: string, items: { id: string; displayOrder: number }[]) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.fieldDef.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
    return { success: true };
  }
}

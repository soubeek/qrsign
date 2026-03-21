import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  @Roles(GlobalRole.VIEWER)
  findAll(@Req() req: any) {
    return this.eventsService.findAll(req.user);
  }

  @Get(':slug')
  @Roles(GlobalRole.VIEWER)
  findBySlug(@Param('slug') slug: string, @Req() req: any) {
    return this.eventsService.findBySlug(slug, req.user);
  }

  @Get(':slug/config')
  @Public()
  getConfig(@Param('slug') slug: string) {
    return this.eventsService.getConfig(slug);
  }

  @Get(':slug/operators')
  @Public()
  getOperators(@Param('slug') slug: string) {
    return this.eventsService.getOperators(slug);
  }

  @Post()
  @Roles(GlobalRole.SUPER_ADMIN)
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':slug')
  @Roles(GlobalRole.ADMIN)
  update(@Param('slug') slug: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(slug, dto);
  }

  @Post(':slug/clone')
  @Roles(GlobalRole.SUPER_ADMIN)
  clone(@Param('slug') slug: string) {
    return this.eventsService.clone(slug);
  }

  @Delete(':slug')
  @Roles(GlobalRole.SUPER_ADMIN)
  remove(@Param('slug') slug: string) {
    return this.eventsService.remove(slug);
  }
}

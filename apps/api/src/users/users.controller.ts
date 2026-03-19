import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignUserEventDto } from './dto/assign-user-event.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(GlobalRole.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(GlobalRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(GlobalRole.SUPER_ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(GlobalRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(GlobalRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/events')
  @Roles(GlobalRole.ADMIN)
  assignEvent(@Param('id') id: string, @Body() dto: AssignUserEventDto) {
    return this.usersService.assignEvent(id, dto);
  }

  @Delete(':id/events/:eventId')
  @Roles(GlobalRole.ADMIN)
  removeEventAssignment(@Param('id') id: string, @Param('eventId') eventId: string) {
    return this.usersService.removeEventAssignment(id, eventId);
  }
}

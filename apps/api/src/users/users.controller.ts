import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignUserEventDto } from './dto/assign-user-event.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN')
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }

  @Post(':id/events')
  @Roles('SUPER_ADMIN')
  assignEvent(@Param('id') id: string, @Body() dto: AssignUserEventDto) {
    return this.usersService.assignEvent(id, dto);
  }

  @Delete(':id/events/:eventId')
  @Roles('SUPER_ADMIN')
  removeEventAssignment(@Param('id') id: string, @Param('eventId') eventId: string) {
    return this.usersService.removeEventAssignment(id, eventId);
  }
}

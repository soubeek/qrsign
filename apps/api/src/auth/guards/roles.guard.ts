import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  OPERATOR: 2,
  VIEWER: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    // SUPER_ADMIN bypasses all
    if (user.role === 'SUPER_ADMIN') return true;

    // Check if user's role is in the required roles
    if (requiredRoles.includes(user.role)) return true;

    // Check event-specific role
    const slug = request.params?.slug;
    if (slug) {
      const event = await this.prisma.event.findUnique({ where: { slug } });
      if (event) {
        const userEvent = await this.prisma.userEvent.findUnique({
          where: { userId_eventId: { userId: user.id, eventId: event.id } },
        });
        if (userEvent?.eventRole && requiredRoles.includes(userEvent.eventRole)) {
          return true;
        }
      }
    }

    return false;
  }
}

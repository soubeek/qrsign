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

    // Check if user's global role meets the minimum required (hierarchy)
    const userLevel = ROLE_HIERARCHY[user.role] || 0;
    const minRequired = Math.min(...requiredRoles.map(r => ROLE_HIERARCHY[r] || 0));
    if (userLevel >= minRequired) return true;

    // Check event-specific role (hierarchy-based)
    const slug = request.params?.slug;
    if (slug) {
      const event = await this.prisma.event.findUnique({ where: { slug } });
      if (event) {
        const userEvent = await this.prisma.userEvent.findUnique({
          where: { userId_eventId: { userId: user.id, eventId: event.id } },
        });
        if (userEvent?.eventRole) {
          const eventLevel = ROLE_HIERARCHY[userEvent.eventRole] || 0;
          if (eventLevel >= minRequired) return true;
        }
      }
    }

    return false;
  }
}

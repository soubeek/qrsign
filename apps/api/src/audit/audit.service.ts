import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    action: string;
    userId?: string;
    userEmail?: string;
    eventSlug?: string;
    targetId?: string;
    targetLabel?: string;
    details?: string;
    ip?: string;
  }) {
    try {
      await this.prisma.auditLog.create({ data: params });
    } catch {
      // Never fail on audit — just log silently
    }
  }

  async findAll(params?: { action?: string; userId?: string; limit?: number; offset?: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(params?.action && { action: params.action }),
        ...(params?.userId && { userId: params.userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: params?.limit || 100,
      skip: params?.offset || 0,
    });
  }

  async count(action?: string) {
    return this.prisma.auditLog.count({
      where: action ? { action } : undefined,
    });
  }
}

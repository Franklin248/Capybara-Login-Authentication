
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: { userId: number };
    }>();

    const user = await this.usersService.findById(
      request.user.userId,
    );

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException(
        'Admin access only',
      );
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard — enforces the @Roles() decorator at the resolver level.
 *
 * Must be used AFTER JwtAuthGuard so that request.user is already populated:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *
 * Roles are checked as a whitelist: the caller's role must appear in the
 * list passed to @Roles(...).  If the handler has no @Roles() decorator,
 * all authenticated users are allowed through.
 *
 * Example:
 *   @Roles('admin', 'manager')        ← only admin or manager may call this
 *   @Mutation(() => User)
 *   createUser(...) {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator — resolver is open to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const gqlCtx = GqlExecutionContext.create(context);
    const { user } = gqlCtx.getContext().req;

    if (!user) {
      // This should not happen if JwtAuthGuard runs first, but guard defensively
      throw new ForbiddenException('User context not found');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      this.logger.warn(
        `Access denied: user=${user.sub} role=${user.role} ` +
          `required=[${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `This operation requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

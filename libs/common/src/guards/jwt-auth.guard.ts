import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JwtAuthGuard — wraps Passport's built-in JWT guard to work with GraphQL.
 *
 * GraphQL requests use a different execution context than HTTP, so the standard
 * AuthGuard cannot find the request without the override below.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)                  ← protects a single resolver
 *   @UseGuards(JwtAuthGuard, RolesGuard)      ← stacks with roles check
 *
 *   @Public()                                 ← opts a resolver OUT of this guard
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Allow handlers decorated with @Public() to skip JWT verification
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * GraphQL execution contexts wrap the raw HTTP request — Passport needs the
   * plain request object to extract the Authorization header.
   */
  getRequest(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext().req;
  }

  handleRequest<T>(err: any, user: T, info: any): T {
    if (err || !user) {
      const message =
        info?.message === 'No auth token'
          ? 'Authorization header is missing'
          : info?.message === 'jwt expired'
            ? 'Access token has expired — please refresh'
            : 'Invalid or missing authorization token';

      this.logger.warn(`JWT auth failed: ${info?.message ?? err?.message}`);
      throw new UnauthorizedException(message);
    }
    return user;
  }
}

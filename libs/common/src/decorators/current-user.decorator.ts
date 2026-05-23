import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * @CurrentUser() — parameter decorator that extracts the authenticated user
 * from the GraphQL request context.
 *
 * The value is populated by JwtStrategy.validate() after Passport verifies
 * the Bearer token.  Shape mirrors JwtPayload:
 *   { sub, email, tenantId, role }
 *
 * Alias helpers are provided below for cleaner resolver signatures.
 *
 * @example
 *   \@Query(() => User)
 *   me(\@CurrentUser() user: JwtPayload): Promise<User> {
 *     return this.usersService.findOne(user.sub, user.tenantId);
 *   }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const gqlCtx = GqlExecutionContext.create(context);
    const { user } = gqlCtx.getContext().req;
    if (!user) {
      return null;
    }
    // Normalize: expose both `sub` and `userId` so callers can use either
    return {
      userId: user.sub,
      sub: user.sub,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };
  },
);

/**
 * @CurrentTenantId() — shorthand to extract only the tenantId.
 *
 * @example
 *   \@Query(() => [User])
 *   users(\@CurrentTenantId() tenantId: string) {}
 */
export const CurrentTenantId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext().req?.user?.tenantId;
  },
);

/**
 * @CurrentUserId() — shorthand to extract only the user's ID (sub claim).
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext().req?.user?.sub;
  },
);

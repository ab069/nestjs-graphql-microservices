import { Resolver, Mutation, Args, Query, Context } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResponse } from './dto/auth-response.type';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { AuditInterceptor } from '@app/common/audit/audit.interceptor';

/**
 * AuthResolver — exposes authentication mutations on the auth-service subgraph.
 *
 * All mutation responses go through AuditInterceptor which logs:
 *   [AUDIT] user:<id> action:<mutationName> tenant:<id> at <ISO timestamp>
 */
@Resolver()
@UseInterceptors(AuditInterceptor)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  @Query(() => String, {
    description: 'Health check — confirms the auth-service subgraph is reachable',
  })
  authHealth(): string {
    return 'auth-service: OK';
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /**
   * register — creates a new user account and returns a token pair.
   * No auth required (public endpoint).
   */
  @Mutation(() => AuthResponse, {
    description:
      'Create a new user account. Returns an access token and refresh token.',
  })
  async register(
    @Args('input') input: RegisterInput,
  ): Promise<AuthResponse> {
    return this.authService.register(input);
  }

  /**
   * login — validates credentials and returns a token pair.
   * No auth required (public endpoint).
   */
  @Mutation(() => AuthResponse, {
    description:
      'Authenticate with email and password. Returns an access token and refresh token.',
  })
  async login(
    @Args('input') input: LoginInput,
  ): Promise<AuthResponse> {
    return this.authService.login(input);
  }

  /**
   * refreshTokens — exchanges a valid refresh token for a new token pair.
   * Implements token rotation: old refresh token is invalidated on use.
   */
  @Mutation(() => AuthResponse, {
    description:
      'Exchange a valid refresh token for a fresh access + refresh token pair.',
  })
  async refreshTokens(
    @Args('refreshToken', { type: () => String }) refreshToken: string,
  ): Promise<AuthResponse> {
    return this.authService.refreshTokens(refreshToken);
  }

  /**
   * logout — invalidates all active sessions for the current user+tenant.
   * Requires a valid JWT.
   */
  @Mutation(() => Boolean, {
    description:
      'Invalidate the current session. Requires a valid Bearer token.',
  })
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: { userId: string; tenantId: string },
    @Context() _ctx: any,
  ): Promise<boolean> {
    return this.authService.logout(user.userId, user.tenantId);
  }
}

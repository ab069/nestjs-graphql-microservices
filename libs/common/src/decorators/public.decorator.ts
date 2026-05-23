import { SetMetadata } from '@nestjs/common';

/**
 * IS_PUBLIC_KEY — metadata flag checked by JwtAuthGuard.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() — marks a resolver or controller as publicly accessible,
 * bypassing JwtAuthGuard entirely.
 *
 * Use sparingly — only on endpoints that genuinely require no authentication
 * (e.g., health checks, public registration, password reset requests).
 *
 * @example
 *   \@Public()
 *   \@Mutation(() => AuthResponse)
 *   register(\@Args('input') input: RegisterInput) {}
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

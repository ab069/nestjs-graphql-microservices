/**
 * @app/common — public API for the shared common library.
 *
 * Import from this barrel file in application code:
 *   import { JwtAuthGuard, Roles, CurrentUser } from '@app/common';
 */

// Module
export * from './common.module';

// Guards
export * from './guards/jwt-auth.guard';
export * from './guards/roles.guard';

// Decorators
export * from './decorators/roles.decorator';
export * from './decorators/current-user.decorator';
export * from './decorators/public.decorator';

// Interceptors
export * from './audit/audit.interceptor';

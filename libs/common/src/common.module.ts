import { Module, Global } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuditInterceptor } from './audit/audit.interceptor';

/**
 * CommonModule — re-exports all shared infrastructure providers.
 *
 * Decorated with @Global() so importing it once in AppModule makes all
 * guards, interceptors, and decorators available without re-importing in
 * every feature module.
 */
@Global()
@Module({
  providers: [JwtAuthGuard, RolesGuard, AuditInterceptor],
  exports: [JwtAuthGuard, RolesGuard, AuditInterceptor],
})
export class CommonModule {}

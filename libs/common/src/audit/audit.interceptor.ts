import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';

/**
 * AuditInterceptor — logs every GraphQL mutation with structured metadata.
 *
 * Output format (single line, structured for log aggregators):
 *   [AUDIT] user:<userId> action:<operationName> tenant:<tenantId> at <ISO8601> duration:<Nms>
 *
 * For unauthenticated mutations (login, register) the user/tenant fields
 * show "anonymous" so the log line is still consistent.
 *
 * Apply at the class level to audit all resolvers in a module, or at the
 * method level for fine-grained control:
 *
 * @example
 *   // Audit entire resolver class
 *   \@UseInterceptors(AuditInterceptor)
 *   \@Resolver(() => User)
 *   export class UsersResolver {}
 *
 *   // Audit a single mutation
 *   \@UseInterceptors(AuditInterceptor)
 *   \@Mutation(() => User)
 *   createUser(...) {}
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AUDIT');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlCtx = GqlExecutionContext.create(context);
    const info = gqlCtx.getInfo();

    // Only audit mutations — skip queries and subscriptions
    if (info?.parentType?.name !== 'Mutation') {
      return next.handle();
    }

    const req = gqlCtx.getContext()?.req;
    const user = req?.user;

    const userId = user?.sub ?? 'anonymous';
    const tenantId = user?.tenantId ?? 'anonymous';
    const action = info.fieldName ?? context.getHandler().name;
    const startedAt = new Date();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt.getTime();
          this.logger.log(
            `user:${userId} action:${action} tenant:${tenantId} at ${startedAt.toISOString()} duration:${durationMs}ms`,
          );
        },
        error: (err: Error) => {
          const durationMs = Date.now() - startedAt.getTime();
          this.logger.warn(
            `user:${userId} action:${action} tenant:${tenantId} at ${startedAt.toISOString()} ` +
              `duration:${durationMs}ms ERROR:${err.message}`,
          );
        },
      }),
    );
  }
}

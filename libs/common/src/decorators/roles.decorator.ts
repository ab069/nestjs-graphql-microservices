import { SetMetadata } from '@nestjs/common';

/**
 * ROLES_KEY — metadata key used by RolesGuard to read the allowed roles.
 */
export const ROLES_KEY = 'roles';

/**
 * @Roles(...roles) — declares which roles are permitted to call a resolver.
 *
 * Requires RolesGuard (stacked after JwtAuthGuard) to be active.
 *
 * @example
 *   // Only admins and managers may create users
 *   \@Roles('admin', 'manager')
 *   \@Mutation(() => User)
 *   createUser(@Args('input') input: CreateUserInput) {}
 *
 *   // Restrict to super_admin only
 *   \@Roles('super_admin')
 *   \@Mutation(() => Boolean)
 *   deleteOrganization(@Args('id') id: string) {}
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

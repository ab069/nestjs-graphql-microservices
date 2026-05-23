import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { UsersService, CallerContext } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { PaginatedUsers } from './dto/paginated-users.type';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { RolesGuard } from '@app/common/guards/roles.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { AuditInterceptor } from '@app/common/audit/audit.interceptor';

/**
 * UsersResolver — GraphQL interface for the users-service subgraph.
 *
 * Security model:
 *  - Every resolver requires a valid JWT (@UseGuards(JwtAuthGuard))
 *  - Write operations additionally require specific roles via @Roles + RolesGuard
 *  - All service calls receive the CallerContext extracted from the JWT so the
 *    service layer can enforce tenant scoping and RBAC without touching the HTTP layer
 *
 * AuditInterceptor is applied at the class level — every mutation is logged:
 *   [AUDIT] user:<id> action:<mutationName> tenant:<id> at <ISO timestamp>
 */
@Resolver(() => User)
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  @Query(() => [User], {
    description: 'Fetch all users in the caller\'s tenant. Results are always tenant-scoped.',
  })
  async users(
    @CurrentUser() caller: CallerContext,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<User[]> {
    const result = await this.usersService.findAll(caller, page, limit, search);
    return result.items;
  }

  @Query(() => PaginatedUsers, {
    description: 'Paginated users list with total count and page metadata.',
  })
  async usersPaginated(
    @CurrentUser() caller: CallerContext,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<PaginatedUsers> {
    return this.usersService.findAll(caller, page, limit, search);
  }

  @Query(() => User, {
    description: 'Fetch a single user by ID. Scoped to caller\'s tenant.',
  })
  async user(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() caller: CallerContext,
  ): Promise<User> {
    return this.usersService.findOne(id, caller);
  }

  @Query(() => User, {
    description: 'Fetch the currently authenticated user\'s profile.',
  })
  async me(@CurrentUser() caller: CallerContext): Promise<User> {
    return this.usersService.findOne(caller.userId, caller);
  }

  // ---------------------------------------------------------------------------
  // Mutations — require elevated roles
  // ---------------------------------------------------------------------------

  /**
   * createUser — admin and manager can create new users.
   * The tenantId is always taken from the JWT, not the input (unless super_admin).
   */
  @Mutation(() => User, {
    description: 'Create a new user in the caller\'s tenant. Requires manager role or above.',
  })
  @Roles('admin', 'manager', 'super_admin')
  async createUser(
    @Args('input') input: CreateUserInput,
    @CurrentUser() caller: CallerContext,
  ): Promise<User> {
    return this.usersService.create(input, caller);
  }

  /**
   * updateUser — users can update their own profile; managers can update members.
   */
  @Mutation(() => User, {
    description: 'Update a user\'s profile. Roles restrict what fields and which users can be updated.',
  })
  async updateUser(
    @Args('input') input: UpdateUserInput,
    @CurrentUser() caller: CallerContext,
  ): Promise<User> {
    return this.usersService.update(input, caller);
  }

  /**
   * deactivateUser — suspends a user's access without deleting their data.
   */
  @Mutation(() => User, {
    description: 'Deactivate a user (suspend access). Requires manager role or above.',
  })
  @Roles('admin', 'manager', 'super_admin')
  async deactivateUser(
    @Args('id') id: string,
    @CurrentUser() caller: CallerContext,
  ): Promise<User> {
    return this.usersService.deactivate(id, caller);
  }

  /**
   * activateUser — re-enables a previously deactivated user.
   */
  @Mutation(() => User, {
    description: 'Reactivate a deactivated user. Requires manager role or above.',
  })
  @Roles('admin', 'manager', 'super_admin')
  async activateUser(
    @Args('id') id: string,
    @CurrentUser() caller: CallerContext,
  ): Promise<User> {
    return this.usersService.activate(id, caller);
  }

  /**
   * removeUser — soft-deletes a user. Admins only.
   * Soft-delete preserves the audit trail; rows are excluded from normal queries.
   */
  @Mutation(() => Boolean, {
    description:
      'Soft-delete a user. The record is retained for audit purposes. Requires admin role or above.',
  })
  @Roles('admin', 'super_admin')
  async removeUser(
    @Args('id') id: string,
    @CurrentUser() caller: CallerContext,
  ): Promise<boolean> {
    return this.usersService.remove(id, caller);
  }

  // ---------------------------------------------------------------------------
  // Computed / Virtual fields
  // ---------------------------------------------------------------------------

  @ResolveField(() => String, {
    description: 'Concatenated first + last name',
  })
  fullName(@Parent() user: User): string {
    return `${user.firstName} ${user.lastName}`;
  }
}

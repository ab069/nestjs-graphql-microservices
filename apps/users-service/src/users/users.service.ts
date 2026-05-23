import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { PaginatedUsers } from './dto/paginated-users.type';

/**
 * Minimal caller context extracted from the validated JWT.
 * The resolver injects this from @CurrentUser() so the service
 * never touches the raw request object.
 */
export interface CallerContext {
  userId: string;
  tenantId: string;
  role: UserRole;
}

/**
 * RBAC helper — roles ordered by privilege (highest index = highest privilege).
 * A caller can only assign/update roles that are strictly lower than their own.
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.VIEWER]: 0,
  [UserRole.MEMBER]: 1,
  [UserRole.MANAGER]: 2,
  [UserRole.ADMIN]: 3,
  [UserRole.SUPER_ADMIN]: 4,
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(input: CreateUserInput, caller: CallerContext): Promise<User> {
    const tenantId = this.resolveTenantId(input.tenantId, caller);

    // RBAC: managers and below cannot elevate roles above their own
    this.assertCanAssignRole(caller.role, input.role);

    // Uniqueness — email is unique per tenant
    const existing = await this.userRepository.findOne({
      where: { email: input.email, tenantId },
      withDeleted: false,
    });
    if (existing) {
      throw new ConflictException(
        `User with email "${input.email}" already exists in this tenant`,
      );
    }

    const saltRounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    const user = this.userRepository.create({
      id: uuidv4(),
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      tenantId,
      role: input.role ?? UserRole.MEMBER,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      title: input.title,
      isActive: true,
      createdBy: caller.userId,
      updatedBy: caller.userId,
    });

    const saved = await this.userRepository.save(user);
    this.logger.log(
      `User created: id=${saved.id} email=${saved.email} tenant=${tenantId} by=${caller.userId}`,
    );
    return saved;
  }

  // ---------------------------------------------------------------------------
  // Read — all queries are automatically tenant-scoped
  // ---------------------------------------------------------------------------

  async findAll(
    caller: CallerContext,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<PaginatedUsers> {
    const tenantId = caller.tenantId;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<User> | FindOptionsWhere<User>[] = search
      ? [
          { tenantId, firstName: ILike(`%${search}%`) },
          { tenantId, lastName: ILike(`%${search}%`) },
          { tenantId, email: ILike(`%${search}%`) },
        ]
      : { tenantId };

    const [items, total] = await this.userRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      withDeleted: false,
    });

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: skip + items.length < total,
    };
  }

  async findOne(id: string, caller: CallerContext): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        id,
        tenantId: caller.tenantId, // ← tenant scope always enforced
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email, tenantId },
    });
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(input: UpdateUserInput, caller: CallerContext): Promise<User> {
    const user = await this.findOne(input.id, caller);

    // Only the user themselves or a higher-privileged caller may update
    if (
      user.id !== caller.userId &&
      ROLE_HIERARCHY[caller.role] <= ROLE_HIERARCHY[user.role]
    ) {
      throw new ForbiddenException(
        'You do not have permission to update this user',
      );
    }

    if (input.role) {
      this.assertCanAssignRole(caller.role, input.role);
    }

    // Merge only the fields that were explicitly provided
    const updatableFields: Partial<User> = {};
    if (input.firstName !== undefined) updatableFields.firstName = input.firstName;
    if (input.lastName !== undefined) updatableFields.lastName = input.lastName;
    if (input.email !== undefined) updatableFields.email = input.email;
    if (input.role !== undefined) updatableFields.role = input.role;
    if (input.displayName !== undefined) updatableFields.displayName = input.displayName;
    if (input.avatarUrl !== undefined) updatableFields.avatarUrl = input.avatarUrl;
    if (input.title !== undefined) updatableFields.title = input.title;
    updatableFields.updatedBy = caller.userId;

    await this.userRepository.update(
      { id: user.id, tenantId: caller.tenantId },
      updatableFields,
    );

    this.logger.log(
      `User updated: id=${user.id} tenant=${caller.tenantId} by=${caller.userId}`,
    );

    return this.findOne(input.id, caller);
  }

  // ---------------------------------------------------------------------------
  // Deactivate / Activate
  // ---------------------------------------------------------------------------

  async deactivate(id: string, caller: CallerContext): Promise<User> {
    const user = await this.findOne(id, caller);

    this.assertManagerOrAbove(caller.role);

    await this.userRepository.update(
      { id, tenantId: caller.tenantId },
      { isActive: false, updatedBy: caller.userId },
    );

    this.logger.log(
      `User deactivated: id=${id} tenant=${caller.tenantId} by=${caller.userId}`,
    );
    return { ...user, isActive: false };
  }

  async activate(id: string, caller: CallerContext): Promise<User> {
    const user = await this.findOne(id, caller);
    this.assertManagerOrAbove(caller.role);

    await this.userRepository.update(
      { id, tenantId: caller.tenantId },
      { isActive: true, updatedBy: caller.userId },
    );

    this.logger.log(
      `User activated: id=${id} tenant=${caller.tenantId} by=${caller.userId}`,
    );
    return { ...user, isActive: true };
  }

  // ---------------------------------------------------------------------------
  // Soft delete
  // ---------------------------------------------------------------------------

  async remove(id: string, caller: CallerContext): Promise<boolean> {
    const user = await this.findOne(id, caller);
    this.assertAdminOrAbove(caller.role);

    // Prevent self-deletion
    if (user.id === caller.userId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    await this.userRepository.softDelete({ id, tenantId: caller.tenantId });
    this.logger.log(
      `User soft-deleted: id=${id} tenant=${caller.tenantId} by=${caller.userId}`,
    );
    return true;
  }

  // ---------------------------------------------------------------------------
  // RBAC helpers
  // ---------------------------------------------------------------------------

  private resolveTenantId(
    inputTenantId: string | undefined,
    caller: CallerContext,
  ): string {
    if (inputTenantId && caller.role === UserRole.SUPER_ADMIN) {
      return inputTenantId;
    }
    // All non-super-admin callers are forced into their own tenant
    return caller.tenantId;
  }

  private assertCanAssignRole(callerRole: UserRole, targetRole: UserRole): void {
    if (ROLE_HIERARCHY[callerRole] <= ROLE_HIERARCHY[targetRole]) {
      throw new ForbiddenException(
        `Role "${callerRole}" cannot assign role "${targetRole}"`,
      );
    }
  }

  private assertManagerOrAbove(role: UserRole): void {
    if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[UserRole.MANAGER]) {
      throw new ForbiddenException('Manager role or above required');
    }
  }

  private assertAdminOrAbove(role: UserRole): void {
    if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[UserRole.ADMIN]) {
      throw new ForbiddenException('Admin role or above required');
    }
  }
}

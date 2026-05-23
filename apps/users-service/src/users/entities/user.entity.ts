import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

/**
 * UserRole — RBAC roles available in the platform.
 * Keep the enum here (source of truth) and re-export via @app/common if other
 * services need to reference it.
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin', // platform-level — can manage all tenants
  ADMIN = 'admin',             // tenant-level admin
  MANAGER = 'manager',         // can manage members within their tenant
  MEMBER = 'member',           // default role — read + limited writes
  VIEWER = 'viewer',           // read-only
}

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'RBAC roles — controls what operations a user may perform',
  valuesMap: {
    SUPER_ADMIN: { description: 'Platform-level administrator' },
    ADMIN: { description: 'Tenant administrator' },
    MANAGER: { description: 'Tenant manager — can manage members' },
    MEMBER: { description: 'Standard member' },
    VIEWER: { description: 'Read-only access' },
  },
});

/**
 * User entity — core identity record for the users-service.
 *
 * Multi-tenancy design:
 *  - Every row belongs to exactly one tenant (tenantId).
 *  - All repository queries in UsersService are scoped with { tenantId }
 *    so data never leaks across tenant boundaries even if a bug exists
 *    in the application layer.
 *
 * Soft-deletes via TypeORM @DeleteDateColumn prevent accidental data loss
 * and maintain an audit trail.
 */
@ObjectType({ description: 'Platform user record' })
@Entity({ name: 'users' })
@Index(['tenantId', 'email'], { unique: true })  // email unique per tenant
@Index(['tenantId', 'role'])
@Index(['tenantId', 'createdAt'])
export class User {
  @Field(() => ID, { description: 'Unique identifier (UUID v4)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ------------------------------------------------------------------
  // Identity
  // ------------------------------------------------------------------

  @Field({ description: 'First name' })
  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Field({ description: 'Last name' })
  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Field({ description: 'Primary email address — unique per tenant' })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /**
   * Password hash — excluded from GraphQL type via @HideField / omission.
   * Never expose this field via the API.
   */
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  // ------------------------------------------------------------------
  // Multi-tenancy
  // ------------------------------------------------------------------

  @Field({ description: 'Tenant this user belongs to (UUID v4)' })
  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  // ------------------------------------------------------------------
  // RBAC
  // ------------------------------------------------------------------

  @Field(() => UserRole, { description: 'User role within their tenant' })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  role: UserRole;

  // ------------------------------------------------------------------
  // Profile
  // ------------------------------------------------------------------

  @Field({ nullable: true, description: 'Display name / alias' })
  @Column({ name: 'display_name', type: 'varchar', length: 150, nullable: true })
  displayName?: string;

  @Field({ nullable: true, description: 'Profile picture URL' })
  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true, description: 'User job title' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  title?: string;

  // ------------------------------------------------------------------
  // Status
  // ------------------------------------------------------------------

  @Field({ description: 'Whether this account is active' })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Field({ nullable: true, description: 'Timestamp of last successful login' })
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  // ------------------------------------------------------------------
  // Audit / Timestamps
  // ------------------------------------------------------------------

  @Field({ description: 'ISO timestamp of record creation' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Field({ description: 'ISO timestamp of last update' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Field({ nullable: true, description: 'Set when the user is soft-deleted' })
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  /** UUID of the user who created this record — populated by AuditInterceptor */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  /** UUID of the user who last updated this record */
  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  /**
   * Optimistic concurrency version counter.
   * TypeORM increments this on every UPDATE; a stale write throws OptimisticLockVersionMismatchError.
   */
  @VersionColumn()
  version: number;

  // ------------------------------------------------------------------
  // Computed / Virtual
  // ------------------------------------------------------------------

  @Field({ description: 'Full name derived from firstName + lastName' })
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

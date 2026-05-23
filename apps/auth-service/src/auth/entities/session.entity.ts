import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Session — tracks active JWT refresh tokens per user.
 * Allows server-side invalidation (logout all devices, revoke on password change).
 *
 * tenant_id is stored here so session queries are always tenant-scoped,
 * preventing cross-tenant session leakage.
 */
@ObjectType()
@Entity({ name: 'sessions' })
@Index(['userId', 'tenantId'])
@Index(['refreshTokenHash'])
export class Session {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @Field()
  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  /**
   * SHA-256 hash of the refresh token — never store raw tokens.
   */
  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 64 })
  refreshTokenHash: string;

  @Field()
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Field()
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Field()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Field()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Field()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

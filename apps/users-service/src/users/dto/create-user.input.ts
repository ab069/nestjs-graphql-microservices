import { InputType, Field } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

/**
 * CreateUserInput — payload for the `createUser` mutation.
 *
 * The tenantId is NOT taken from this input in production; it is always
 * extracted from the JWT payload (req.user.tenantId) to prevent privilege
 * escalation. The field is retained here for super-admin operations only.
 */
@InputType()
export class CreateUserInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @Field()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @Field()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]+$/,
    {
      message:
        'Password must contain uppercase, lowercase, number, and special character',
    },
  )
  password: string;

  @Field(() => UserRole, { defaultValue: UserRole.MEMBER })
  @IsEnum(UserRole)
  role: UserRole = UserRole.MEMBER;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  /**
   * Super-admin only: assign user to a specific tenant.
   * Regular admins/managers get the tenantId injected from their JWT.
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;
}

import { InputType, Field, PartialType, OmitType } from '@nestjs/graphql';
import { IsUUID, IsNotEmpty } from 'class-validator';
import { CreateUserInput } from './create-user.input';

/**
 * UpdateUserInput — all fields from CreateUserInput are optional except `id`.
 * Password updates intentionally require a dedicated mutation (changePassword)
 * with current-password verification — omitted here to prevent accidental overwrites.
 */
@InputType()
export class UpdateUserInput extends PartialType(
  OmitType(CreateUserInput, ['password'] as const),
) {
  @Field({ description: 'UUID of the user to update' })
  @IsNotEmpty()
  @IsUUID('4')
  id: string;
}

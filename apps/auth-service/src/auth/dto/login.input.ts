import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * LoginInput — payload for the `login` mutation.
 */
@InputType()
export class LoginInput {
  @Field()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255)
  email: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  password: string;
}

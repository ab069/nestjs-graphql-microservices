import { ObjectType, Field } from '@nestjs/graphql';

/**
 * AuthResponse — returned by both `login` and `register` mutations.
 * The gateway forwards both tokens to the client; accessToken goes in the
 * Authorization header for subsequent requests, refreshToken is stored
 * in an HttpOnly cookie.
 */
@ObjectType()
export class AuthResponse {
  @Field({ description: 'Short-lived JWT for API authorization (15 min default)' })
  accessToken: string;

  @Field({ description: 'Long-lived token used to obtain new access tokens' })
  refreshToken: string;

  @Field({ description: 'Access token TTL in seconds' })
  expiresIn: number;

  @Field({ description: 'Token type — always "Bearer"' })
  tokenType: string;

  @Field({ description: 'ID of the authenticated user' })
  userId: string;

  @Field({ description: 'Tenant the authenticated user belongs to' })
  tenantId: string;
}

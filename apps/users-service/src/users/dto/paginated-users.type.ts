import { ObjectType, Field, Int } from '@nestjs/graphql';
import { User } from '../entities/user.entity';

/**
 * PaginatedUsers — cursor-style pagination wrapper returned by `users` query.
 */
@ObjectType()
export class PaginatedUsers {
  @Field(() => [User], { description: 'Page of user records' })
  items: User[];

  @Field(() => Int, { description: 'Total number of users matching the filter' })
  total: number;

  @Field(() => Int, { description: 'Current page number (1-based)' })
  page: number;

  @Field(() => Int, { description: 'Number of items per page' })
  limit: number;

  @Field({ description: 'Whether there is a next page' })
  hasNextPage: boolean;
}

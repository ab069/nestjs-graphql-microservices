import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { join } from 'path';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';

@Module({
  imports: [
    // ------------------------------------------------------------------
    // Config
    // ------------------------------------------------------------------
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ------------------------------------------------------------------
    // Passport — required by JwtAuthGuard even in the users-service
    // (token is already validated; this just wires up the strategy)
    // ------------------------------------------------------------------
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // ------------------------------------------------------------------
    // JWT — users-service only needs to VERIFY tokens, not sign them
    // ------------------------------------------------------------------
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),

    // ------------------------------------------------------------------
    // GraphQL — code-first Apollo Federation v2 subgraph
    // ------------------------------------------------------------------
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'apps/users-service/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      context: ({ req }: { req: any }) => ({ req }),
      federationVersion: 2,
    }),

    // ------------------------------------------------------------------
    // TypeORM — users-service database
    // ------------------------------------------------------------------
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('USERS_DB_HOST', 'localhost'),
        port: config.get<number>('USERS_DB_PORT', 5434),
        username: config.get<string>('USERS_DB_USERNAME', 'postgres'),
        password: config.get<string>('USERS_DB_PASSWORD', 'postgres'),
        database: config.get<string>('USERS_DB_NAME', 'users_db'),
        entities: [User],
        synchronize: config.get<boolean>('USERS_DB_SYNCHRONIZE', true),
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    UsersModule,
  ],
})
export class AppModule {}

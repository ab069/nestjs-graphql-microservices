import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { Session } from './auth/entities/session.entity';

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
    // GraphQL — code-first with Apollo Federation v2 subgraph
    // ------------------------------------------------------------------
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'apps/auth-service/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      context: ({ req }: { req: any }) => ({ req }),
      // Subgraph federation directives
      federationVersion: 2,
    }),

    // ------------------------------------------------------------------
    // TypeORM — auth-service database
    // ------------------------------------------------------------------
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('AUTH_DB_HOST', 'localhost'),
        port: config.get<number>('AUTH_DB_PORT', 5433),
        username: config.get<string>('AUTH_DB_USERNAME', 'postgres'),
        password: config.get<string>('AUTH_DB_PASSWORD', 'postgres'),
        database: config.get<string>('AUTH_DB_NAME', 'auth_db'),
        entities: [Session],
        synchronize: config.get<boolean>('AUTH_DB_SYNCHRONIZE', true),
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    // ------------------------------------------------------------------
    // JWT — global token signing config
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

    AuthModule,
  ],
})
export class AppModule {}

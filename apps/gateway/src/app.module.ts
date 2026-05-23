import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

/**
 * Attaches the forwarded Authorization header from the client request to every
 * downstream subgraph request so JWT guards work transparently.
 */
class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }: { request: any; context: any }): void {
    if (context?.req?.headers?.authorization) {
      request.http.headers.set(
        'authorization',
        context.req.headers.authorization,
      );
    }

    // Forward tenant context so every service can scope queries automatically
    if (context?.req?.headers?.['x-tenant-id']) {
      request.http.headers.set(
        'x-tenant-id',
        context.req.headers['x-tenant-id'],
      );
    }
  }
}

@Module({
  imports: [
    // ------------------------------------------------------------------
    // Config — loads .env and makes values available via ConfigService
    // ------------------------------------------------------------------
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ------------------------------------------------------------------
    // GraphQL Federation Gateway
    // Stitches auth-service and users-service subgraphs into a single
    // unified schema exposed to clients on /graphql
    // ------------------------------------------------------------------
    GraphQLModule.forRootAsync({
      driver: undefined as any, // driver is overridden by ApolloGateway below
      useFactory: (config: ConfigService) => ({
        server: {
          plugins: [
            ApolloServerPluginLandingPageLocalDefault({ embed: true }),
          ],
          introspection: true,
          context: ({ req }: { req: any }) => ({ req }),
        },
        gateway: new ApolloGateway({
          supergraphSdl: new IntrospectAndCompose({
            subgraphs: [
              {
                name: 'auth',
                url: `http://localhost:${config.get('AUTH_SERVICE_PORT', 3001)}/graphql`,
              },
              {
                name: 'users',
                url: `http://localhost:${config.get('USERS_SERVICE_PORT', 3002)}/graphql`,
              },
            ],
          }),
          buildService({ url }) {
            return new AuthenticatedDataSource({ url });
          },
        }),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}

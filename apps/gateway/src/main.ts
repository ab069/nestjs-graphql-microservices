import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('GATEWAY_PORT', 3000);

  // Global validation pipe — strips unknown properties, transforms types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — tighten origins in production
  app.enableCors({
    origin: config.get<string>('ALLOWED_ORIGINS', '*'),
    credentials: true,
  });

  await app.listen(port);
  Logger.log(
    `🚀  Gateway is running on: http://localhost:${port}/graphql`,
    'Bootstrap',
  );
  Logger.log(
    `📊  GraphQL Playground: http://localhost:${port}/graphql`,
    'Bootstrap',
  );
}

bootstrap();

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.use(compression());
  app.enableCors({ origin: process.env.NODE_ENV === 'production' ? process.env.APP_URL : '*' });

  // Global prefix
  app.setGlobalPrefix('v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Buraco Card Game API')
    .setDescription('Server-authoritative multiplayer backend for Buraco card game')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Profile')
    .addTag('Stats')
    .addTag('Economy')
    .addTag('Missions')
    .addTag('Friends')
    .addTag('Clubs')
    .addTag('Rankings')
    .addTag('Shop')
    .addTag('Notifications')
    .addTag('Matchmaking')
    .addTag('Rooms')
    .addTag('Game')
    .addTag('Messaging')
    .addTag('Match History')
    .addTag('Admin')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Buraco API running on port ${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();

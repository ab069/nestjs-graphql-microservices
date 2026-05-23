import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Session } from './entities/session.entity';
import { CommonModule } from '@app/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CommonModule,
  ],
  providers: [AuthService, AuthResolver, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

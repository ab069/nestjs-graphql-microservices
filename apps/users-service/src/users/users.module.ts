import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from './entities/user.entity';
import { CommonModule } from '@app/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CommonModule,
  ],
  providers: [UsersService, UsersResolver, JwtStrategy],
  exports: [UsersService],
})
export class UsersModule {}

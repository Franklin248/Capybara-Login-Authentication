
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { CapybaraScore } from './capybara-score.entity.js';
import { FlappyBaraScore } from './flappy-bara-score.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, CapybaraScore, FlappyBaraScore,])],
  controllers: [UsersController],
  providers: [UsersService, AdminGuard],
  exports: [UsersService, AdminGuard],
})
export class UsersModule {}

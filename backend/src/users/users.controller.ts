
import {
  Controller,
  Get,
  Put,
  Delete,
  UseGuards,
  Req,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto.js';
import { DeleteUserDto } from './dto/delete-user.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get('profile')
  async getProfile(
    @Req() req: { user: { userId: number } },
  ) {
    const user = await this.usersService.findById(
      req.user.userId,
    );

    if (!user) {
      return {
        message: 'User not found',
      };
    }

    return {
      message: 'Profile retrieved successfully',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  @Put('profile')
  updateProfile(
    @Req() req: { user: { userId: number } },
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(
      req.user.userId,
      dto,
    );
  }

  @Delete('profile')
  deleteProfile(
    @Req() req: { user: { userId: number } },
    @Body() dto: DeleteUserDto,
  ) {
    return this.usersService.deleteUser(
      req.user.userId,
      dto.password,
    );
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  getAllUsers() {
    return this.usersService.findAllUsers();
  }

  @Put('admin/:id')
  @UseGuards(AdminGuard)
  updateUserAsAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.usersService.adminUpdateUser(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(AdminGuard)
  deleteUserAsAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { userId: number } },
  ) {
    return this.usersService.adminDeleteUser(
      id,
      req.user.userId,
    );
  }
}

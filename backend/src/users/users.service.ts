
import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
    });
  }

  findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  createUser(
    name: string,
    username: string,
    email: string | null,
    password: string,
  ): Promise<User> {
    const user = this.userRepository.create({
      name,
      username,
      email: email || null,
      password,
    });

    return this.userRepository.save(user);
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.name !== undefined) {
      user.name = dto.name.trim();
    }

    if (dto.username !== undefined) {
      const username = dto.username.trim().toLowerCase();

      const existingUsername = await this.findByUsername(username);

      if (existingUsername && existingUsername.id !== id) {
        throw new ConflictException('Username is already taken');
      }

      user.username = username;
    }

    if (dto.email !== undefined) {
      const email = dto.email?.trim().toLowerCase() || null;

      if (email) {
        const existingEmail = await this.findByEmail(email);

        if (existingEmail && existingEmail.id !== id) {
          throw new ConflictException('Email is already registered');
        }
      }

      user.email = email;
    }

    if (dto.newPassword !== undefined) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to change your password',
        );
      }

      const isPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      user.password = await bcrypt.hash(dto.newPassword, 10);
    }

    const updatedUser = await this.userRepository.save(user);

    return {
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        username: updatedUser.username,
        email: updatedUser.email,
      },
    };
  }

  async deleteUser(id: number, password: string) {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Password is incorrect');
    }

    await this.userRepository.remove(user);

    return {
      message: 'Account deleted successfully',
    };
  }
}

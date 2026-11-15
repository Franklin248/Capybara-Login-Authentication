
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
import { AdminUpdateUserDto } from './dto/admin-update-user.dto.js';
import { CapybaraScore } from './capybara-score.entity.js';
import { FlappyBaraScore } from './flappy-bara-score.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(CapybaraScore)
    private readonly scoreRepository: Repository<CapybaraScore>,

    @InjectRepository(FlappyBaraScore)
    private readonly flappyBaraScoreRepository: Repository<FlappyBaraScore>,
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
      role: 'user',
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

  async findAllUsers() {
    return this.userRepository.find({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async adminUpdateUser(
    id: number,
    dto: AdminUpdateUserDto,
  ) {
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
      user.password = await bcrypt.hash(dto.newPassword, 10);
    }

    const updatedUser = await this.userRepository.save(user);

    return {
      message: 'Account updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    };
  }

  async adminDeleteUser(id: number, adminId: number) {
    if (id === adminId) {
      throw new BadRequestException(
        'You cannot delete your own account here',
      );
    }

    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'admin') {
      throw new BadRequestException(
        'Admin accounts cannot be deleted through this action',
      );
    }

    await this.userRepository.remove(user);

    return {
      message: 'Account deleted successfully',
    };
  }

  // CAPYBARA SNAKE LEADERBOARD

  async getLeaderboard() {
    return this.scoreRepository
      .createQueryBuilder('score')
      .leftJoinAndSelect('score.user', 'user')
      .select([
        'score.id',
        'score.highScore',
        'score.updatedAt',
        'user.id',
        'user.name',
        'user.username',
      ])
      .orderBy('score.highScore', 'DESC')
      .addOrderBy('score.updatedAt', 'ASC')
      .limit(10)
      .getMany();
  }

  async submitScore(userId: number, score: number) {
    if (
      !Number.isSafeInteger(score) ||
      score < 0 ||
      score > 1000000
    ) {
      throw new BadRequestException('Invalid game score');
    }

    let record = await this.scoreRepository.findOne({
      where: {
        user: { id: userId },
      },
    });

    if (!record) {
      record = this.scoreRepository.create({
        user: { id: userId },
        highScore: score,
      });
    } else if (score > record.highScore) {
      record.highScore = score;
    }

    const saved = await this.scoreRepository.save(record);

    return {
      message: 'Score submitted successfully',
      highScore: saved.highScore,
    };
  }

  // FLAPPY-BARA LEADERBOARD

  async getFlappyBaraLeaderboard() {
    return this.flappyBaraScoreRepository
      .createQueryBuilder('score')
      .leftJoinAndSelect('score.user', 'user')
      .select([
        'score.id',
        'score.highScore',
        'score.updatedAt',
        'user.id',
        'user.name',
        'user.username',
      ])
      .orderBy('score.highScore', 'DESC')
      .addOrderBy('score.updatedAt', 'ASC')
      .limit(10)
      .getMany();
  }

  async submitFlappyBaraScore(userId: number, score: number) {
    if (
      !Number.isSafeInteger(score) ||
      score < 0 ||
      score > 1000000
    ) {
      throw new BadRequestException('Invalid game score');
    }

    let record = await this.flappyBaraScoreRepository.findOne({
      where: {
        user: { id: userId },
      },
    });

    if (!record) {
      record = this.flappyBaraScoreRepository.create({
        user: { id: userId },
        highScore: score,
      });
    } else if (score > record.highScore) {
      record.highScore = score;
    }

    const saved = await this.flappyBaraScoreRepository.save(record);

    return {
      message: 'Flappy-Bara score submitted successfully',
      highScore: saved.highScore,
    };
  }
}

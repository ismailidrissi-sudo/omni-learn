import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let jwtService: { sign: jest.Mock };
  let emailService: { enqueue: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwtService = { sign: jest.fn().mockReturnValue('mock-jwt-token') };
    emailService = { enqueue: jest.fn().mockResolvedValue('mock-queue-id') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('signUp', () => {
    it('should throw ConflictException if user already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
      await expect(service.signUp('test@test.com', 'password123', 'Test')).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if password is too short', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.signUp('test@test.com', 'short', 'Test')).rejects.toThrow(BadRequestException);
    });

    it('should create user and send verification email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'new-id', email: 'new@test.com', name: 'Test' });

      const result = await service.signUp('new@test.com', 'password123', 'Test');

      expect(result.userId).toBe('new-id');
      expect(result.message).toContain('Verification email sent');
      expect(emailService.enqueue).toHaveBeenCalled();
    });
  });

  describe('loginWithPassword', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.loginWithPassword('nobody@test.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1', email: 'test@test.com', passwordHash: '$2b$10$hash', emailVerified: false,
      });
      await expect(service.loginWithPassword('test@test.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.refreshToken('bad-id')).rejects.toThrow(UnauthorizedException);
    });

    it('should return new token for valid user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
      const result = await service.refreshToken('1');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ sub: '1' }));
    });
  });

  describe('devLogin', () => {
    it('should throw if ADMIN_EMAIL not configured', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD;
      await expect(service.devLogin('a@b.com', 'p')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for wrong credentials', async () => {
      process.env.ADMIN_EMAIL = 'admin@test.com';
      process.env.ADMIN_PASSWORD = 'secret';
      await expect(service.devLogin('wrong@test.com', 'secret')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getRolesFromPayload', () => {
    it('should map Keycloak roles to RBAC roles', () => {
      const roles = service.getRolesFromPayload({
        sub: '1',
        realm_access: { roles: ['super_admin', 'learner_basic'] },
      });
      expect(roles).toContain('SUPER_ADMIN');
      expect(roles).toContain('LEARNER_BASIC');
    });

    it('should return empty array for no roles', () => {
      const roles = service.getRolesFromPayload({ sub: '1' });
      expect(roles).toEqual([]);
    });
  });
});

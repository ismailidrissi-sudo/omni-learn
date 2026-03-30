import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { SubscriptionPlan } from '@prisma/client';

export class SignUpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** When true, user requests to be a trainer (content creator); requires admin approval */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  trainerRequested?: boolean;

  @IsOptional()
  @IsString()
  referralCode?: string;

  /** Branded academy slug — user joins tenant with pending org approval after email verification */
  @IsOptional()
  @IsString()
  tenantSlug?: string;

  /** Paid plans require super-admin approval before full access */
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  planId?: SubscriptionPlan;
}

export class PasswordResetRequestDto {
  @IsEmail()
  email: string;
}

export class PasswordResetConfirmDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class GoogleSignInDto {
  @IsString()
  credential: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class LinkedInSignInDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}

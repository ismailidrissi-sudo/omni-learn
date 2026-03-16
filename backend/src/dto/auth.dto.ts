import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

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
}

export class LinkedInSignInDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}

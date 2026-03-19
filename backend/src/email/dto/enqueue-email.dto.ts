import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EmailPriority } from '../constants';

export class EnqueueEmailDto {
  @IsEmail()
  toEmail: string;

  @IsString()
  subject: string;

  @IsString()
  htmlBody: string;

  @IsOptional()
  @IsString()
  toName?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string;

  @IsOptional()
  @IsString()
  textBody?: string;

  @IsOptional()
  @IsString()
  emailType?: string = 'transactional';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  priority?: number = EmailPriority.NORMAL;

  @IsOptional()
  scheduledFor?: Date;

  @IsOptional()
  @IsString()
  triggeredBy?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class EnqueueFromTemplateDto {
  @IsEmail()
  toEmail: string;

  @IsString()
  templateSlug: string;

  variables: Record<string, string>;

  @IsOptional()
  @IsString()
  toName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  priority?: number = EmailPriority.NORMAL;

  @IsOptional()
  @IsString()
  triggeredBy?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateEmailConfigDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  defaultFromName?: string;

  @IsOptional()
  @IsEmail()
  defaultFromEmail?: string;

  @IsOptional()
  @IsString()
  defaultReplyTo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  dailySendLimit?: number;

  @IsOptional()
  @IsString()
  overflowStrategy?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  overflowSendHour?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SendTestEmailDto {
  @IsEmail()
  toEmail: string;
}

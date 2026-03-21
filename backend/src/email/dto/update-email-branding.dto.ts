import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class FooterLinkDto {
  @IsString()
  label!: string;

  @IsString()
  url!: string;
}

export class UpdateEmailBrandingDto {
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  accentColor?: string;

  @IsOptional()
  @IsString()
  textColor?: string;

  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  surfaceColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  fontFamilyAr?: string;

  @IsOptional()
  @IsString()
  borderRadius?: string;

  @IsOptional()
  @IsObject()
  buttonStyle?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderEmail?: string;

  @IsOptional()
  @IsString()
  replyToEmail?: string | null;

  @IsOptional()
  @IsString()
  footerText?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterLinkDto)
  footerLinks?: FooterLinkDto[];

  @IsOptional()
  @IsString()
  customCss?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

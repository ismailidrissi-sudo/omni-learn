import { IsString, IsOptional } from 'class-validator';

export class ResolveVideoDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  preferredQuality?: string;
}

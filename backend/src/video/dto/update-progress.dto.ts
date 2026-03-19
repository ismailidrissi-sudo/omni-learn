import { IsString, IsNumber, IsBoolean, IsOptional, IsArray } from 'class-validator';

export class UpdateProgressDto {
  @IsString()
  userId: string;

  @IsString()
  contentId: string;

  @IsNumber()
  watchedSeconds: number;

  @IsNumber()
  totalDurationSeconds: number;

  @IsOptional()
  @IsNumber()
  furthestPositionSeconds?: number;

  @IsNumber()
  watchPercentage: number;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsNumber()
  lastPositionSeconds?: number;

  @IsOptional()
  @IsNumber()
  seekCount?: number;

  @IsOptional()
  @IsNumber()
  pauseCount?: number;

  @IsOptional()
  @IsNumber()
  playCount?: number;

  @IsOptional()
  @IsArray()
  watchedIntervals?: number[][];
}

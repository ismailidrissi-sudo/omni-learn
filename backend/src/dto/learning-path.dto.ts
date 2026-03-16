import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class EnrollDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  deadline?: string;
}

export class UpdateStepProgressDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  timeSpent?: number;

  @IsOptional()
  @IsNumber()
  score?: number;
}

export class ReorderDto {
  @IsArray()
  @IsString({ each: true })
  sectionIds?: string[];

  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}

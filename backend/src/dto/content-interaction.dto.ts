import { IsIn, IsString, MinLength } from 'class-validator';

export class ContentInteractionDto {
  @IsString()
  @MinLength(1)
  contentId: string;

  @IsString()
  @MinLength(1)
  contentType: string;

  @IsIn(['view', 'preview', 'bookmark', 'enroll', 'complete'])
  interactionType: string;
}

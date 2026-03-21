import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class UnsubscribeBodyDto {
  @IsString()
  uid!: string;

  @IsString()
  evt!: string;

  @IsString()
  sig!: string;

  @Type(() => Number)
  @IsNumber()
  exp!: number;
}

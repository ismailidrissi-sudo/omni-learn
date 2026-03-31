import { Field, ID, InputType, GraphQLISODateTime } from '@nestjs/graphql';
import { IsDate, IsOptional, IsString, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { GeoMetric } from './geo-graphql.enums';

@InputType()
export class DateRangeInput {
  @Field(() => GraphQLISODateTime)
  @IsDate()
  start!: Date;

  @Field(() => GraphQLISODateTime)
  @IsDate()
  end!: Date;
}

@InputType()
export class GeoOverviewArgs {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  tenantId?: string | null;

  @Field(() => DateRangeInput)
  @ValidateNested()
  @Type(() => DateRangeInput)
  period!: DateRangeInput;

  @Field(() => GeoMetric, { nullable: true, defaultValue: GeoMetric.ACTIVE_USERS })
  @IsOptional()
  @IsEnum(GeoMetric)
  metric?: GeoMetric;
}

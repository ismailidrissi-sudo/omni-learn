import { Field, ID, InputType, GraphQLISODateTime } from '@nestjs/graphql';
import { GeoMetric } from './geo-graphql.enums';

@InputType()
export class DateRangeInput {
  @Field(() => GraphQLISODateTime)
  start!: Date;

  @Field(() => GraphQLISODateTime)
  end!: Date;
}

@InputType()
export class GeoOverviewArgs {
  @Field(() => ID, { nullable: true })
  tenantId?: string | null;

  @Field(() => DateRangeInput)
  period!: DateRangeInput;

  @Field(() => GeoMetric, { nullable: true, defaultValue: GeoMetric.ACTIVE_USERS })
  metric?: GeoMetric;
}

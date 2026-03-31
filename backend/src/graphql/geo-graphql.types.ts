import { Field, Float, ID, Int, ObjectType, GraphQLISODateTime } from '@nestjs/graphql';

@ObjectType()
export class CountryStatsGql {
  @Field(() => String)
  country!: string;

  @Field(() => String)
  countryCode!: string;

  @Field(() => String, { nullable: true })
  topCity?: string | null;

  @Field(() => Int)
  activeUsers!: number;

  @Field(() => Int)
  newRegistrations!: number;

  @Field(() => Int)
  courseCompletions!: number;

  @Field(() => Int)
  pathCompletions!: number;

  @Field(() => Int)
  certsIssued!: number;

  @Field(() => Int)
  totalTimeSpentMin!: number;

  @Field(() => Float, { nullable: true })
  avgQuizScore?: number | null;

  @Field(() => Int)
  webSessions!: number;

  @Field(() => Int)
  iosSessions!: number;

  @Field(() => Int)
  androidSessions!: number;
}

@ObjectType()
export class ContinentStatsGql {
  @Field(() => String)
  continent!: string;

  @Field(() => Int)
  countries!: number;

  @Field(() => Int)
  activeUsers!: number;

  @Field(() => Float)
  percentageOfTotal!: number;
}

@ObjectType()
export class GeoOverviewGql {
  @Field(() => [CountryStatsGql])
  countries!: CountryStatsGql[];

  @Field(() => [ContinentStatsGql])
  continents!: ContinentStatsGql[];

  @Field(() => Int)
  totalCountries!: number;

  @Field(() => Int)
  totalCities!: number;
}

@ObjectType()
export class CityStatsGql {
  @Field(() => String)
  city!: string;

  @Field(() => String, { nullable: true })
  region?: string | null;

  @Field(() => Int)
  totalUsers!: number;

  @Field(() => Int)
  activeUsers!: number;

  @Field(() => Int)
  completions!: number;
}

@ObjectType()
export class DomainShareGql {
  @Field(() => String)
  domainId!: string;

  @Field(() => String)
  domainName!: string;

  @Field(() => Float)
  percentage!: number;

  @Field(() => Int)
  userCount!: number;
}

@ObjectType()
export class DailyMetricGql {
  @Field(() => GraphQLISODateTime)
  date!: Date;

  @Field(() => Int)
  activeUsers!: number;

  @Field(() => Int)
  completions!: number;

  @Field(() => Int)
  newSignups!: number;
}

@ObjectType()
export class DeviceBreakdownGql {
  @Field(() => Int)
  web!: number;

  @Field(() => Int)
  ios!: number;

  @Field(() => Int)
  android!: number;

  @Field(() => Float)
  webPct!: number;

  @Field(() => Float)
  iosPct!: number;

  @Field(() => Float)
  androidPct!: number;
}

@ObjectType()
export class CountryKpisGql {
  @Field(() => Int)
  activeUsers!: number;

  @Field(() => Float)
  activeUsersDelta!: number;

  @Field(() => Int)
  newSignups!: number;

  @Field(() => Float)
  newSignupsDelta!: number;

  @Field(() => Int)
  completions!: number;

  @Field(() => Float)
  completionsDelta!: number;

  @Field(() => Int)
  certsIssued!: number;
}

@ObjectType()
export class LeaderboardEntryGql {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  displayName!: string;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => Int)
  points!: number;

  @Field(() => Int)
  pathsDone!: number;

  @Field(() => Int)
  certs!: number;
}

@ObjectType()
export class CountryDetailGql {
  @Field(() => String)
  country!: string;

  @Field(() => String)
  countryCode!: string;

  @Field(() => [CityStatsGql])
  cities!: CityStatsGql[];

  @Field(() => [DomainShareGql])
  domainPopularity!: DomainShareGql[];

  @Field(() => [DailyMetricGql])
  dailyTrend!: DailyMetricGql[];

  @Field(() => DeviceBreakdownGql)
  deviceBreakdown!: DeviceBreakdownGql;

  @Field(() => [LeaderboardEntryGql])
  topLearners!: LeaderboardEntryGql[];

  @Field(() => CountryKpisGql)
  kpis!: CountryKpisGql;
}

@ObjectType()
export class CountryComparisonEntryGql {
  @Field(() => String)
  country!: string;

  @Field(() => String)
  countryCode!: string;

  @Field(() => Int)
  activeUsers!: number;

  @Field(() => Float)
  avgTimePerUser!: number;

  @Field(() => Float)
  completionRate!: number;

  @Field(() => String)
  topDomain!: string;

  @Field(() => String)
  topCity!: string;

  @Field(() => Int)
  certsIssued!: number;

  @Field(() => Float)
  avgQuizScore!: number;
}

@ObjectType()
export class CountryTrendLineGql {
  @Field(() => String)
  country!: string;

  @Field(() => String)
  countryCode!: string;

  @Field(() => [DailyMetricGql])
  dailyData!: DailyMetricGql[];
}

@ObjectType()
export class CountryComparisonGql {
  @Field(() => [CountryComparisonEntryGql])
  countries!: CountryComparisonEntryGql[];

  @Field(() => [CountryTrendLineGql])
  trendOverlay!: CountryTrendLineGql[];
}

@ObjectType()
export class LiveActivityEntryGql {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  userName!: string;

  @Field(() => String)
  city!: string;

  @Field(() => String)
  country!: string;

  @Field(() => String)
  action!: string;

  @Field(() => String)
  contentTitle!: string;

  @Field(() => GraphQLISODateTime)
  timestamp!: Date;
}

@ObjectType()
export class CountrySearchResultGql {
  @Field(() => String)
  country!: string;

  @Field(() => String)
  countryCode!: string;
}

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard } from '../auth/guards/gql-jwt-auth.guard';
import { GqlRbacGuard } from '../auth/guards/gql-rbac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RbacRole } from '../constants/rbac.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUserPayload } from '../auth/types/request-user.types';
import { GeoAnalyticsGqlService } from './geo-graphql.service';
import { GeoMetric } from './geo-graphql.enums';
import { DateRangeInput } from './geo-graphql.inputs';
import {
  CountryComparisonGql,
  CountryDetailGql,
  CountrySearchResultGql,
  GeoOverviewGql,
  LiveActivityEntryGql,
} from './geo-graphql.types';

@Resolver()
export class GeoGqlResolver {
  constructor(private readonly geo: GeoAnalyticsGqlService) {}

  @Query(() => GeoOverviewGql)
  @UseGuards(GqlJwtAuthGuard, GqlRbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  geoOverview(
    @CurrentUser() user: RequestUserPayload,
    @Args('tenantId', { type: () => ID, nullable: true }) tenantId: string | null,
    @Args('period', { type: () => DateRangeInput }) period: DateRangeInput,
    @Args('metric', { type: () => GeoMetric, nullable: true, defaultValue: GeoMetric.ACTIVE_USERS })
    metric: GeoMetric,
  ) {
    return this.geo.getGeoOverview(user, tenantId, period.start, period.end, metric);
  }

  @Query(() => CountryDetailGql)
  @UseGuards(GqlJwtAuthGuard, GqlRbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  countryAnalytics(
    @CurrentUser() user: RequestUserPayload,
    @Args('countryCode', { type: () => String }) countryCode: string,
    @Args('period', { type: () => DateRangeInput }) period: DateRangeInput,
    @Args('tenantId', { type: () => ID, nullable: true }) tenantId: string | null,
  ) {
    return this.geo.getCountryAnalytics(user, countryCode, period.start, period.end, tenantId);
  }

  @Query(() => CountryComparisonGql)
  @UseGuards(GqlJwtAuthGuard, GqlRbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  compareCountries(
    @CurrentUser() user: RequestUserPayload,
    @Args('countryCodes', { type: () => [String] }) countryCodes: string[],
    @Args('period', { type: () => DateRangeInput }) period: DateRangeInput,
    @Args('tenantId', { type: () => ID, nullable: true }) tenantId: string | null,
  ) {
    return this.geo.compareCountries(user, countryCodes, period.start, period.end, tenantId);
  }

  @Query(() => [LiveActivityEntryGql])
  @UseGuards(GqlJwtAuthGuard, GqlRbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  liveActivity(
    @CurrentUser() user: RequestUserPayload,
    @Args('tenantId', { type: () => ID, nullable: true }) tenantId: string | null,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number,
    @Args('countryCode', { type: () => String, nullable: true }) countryCode: string | null,
  ) {
    return this.geo.liveActivity(user, limit, countryCode ?? undefined, tenantId);
  }

  @Query(() => [CountrySearchResultGql])
  @UseGuards(GqlJwtAuthGuard, GqlRbacGuard)
  @Roles(RbacRole.SUPER_ADMIN, RbacRole.COMPANY_ADMIN, RbacRole.COMPANY_MANAGER)
  searchCountries(@Args('query', { type: () => String }) query: string) {
    return this.geo.searchCountries(query);
  }
}

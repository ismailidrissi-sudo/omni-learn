import { registerEnumType } from '@nestjs/graphql';

export enum GeoMetric {
  ACTIVE_USERS = 'ACTIVE_USERS',
  NEW_REGISTRATIONS = 'NEW_REGISTRATIONS',
  COURSE_COMPLETIONS = 'COURSE_COMPLETIONS',
  CERTS_ISSUED = 'CERTS_ISSUED',
  TOTAL_TIME_SPENT = 'TOTAL_TIME_SPENT',
}

registerEnumType(GeoMetric, { name: 'GeoMetric' });

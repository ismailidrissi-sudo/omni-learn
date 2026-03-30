import { gql } from "@apollo/client";

export const GEO_OVERVIEW = gql`
  query GeoOverview($tenantId: ID, $period: DateRangeInput!, $metric: GeoMetric) {
    geoOverview(tenantId: $tenantId, period: $period, metric: $metric) {
      totalCountries
      totalCities
      countries {
        country
        countryCode
        topCity
        activeUsers
        newRegistrations
        courseCompletions
        pathCompletions
        certsIssued
        totalTimeSpentMin
        webSessions
        iosSessions
        androidSessions
      }
      continents {
        continent
        countries
        activeUsers
        percentageOfTotal
      }
    }
  }
`;

export const COUNTRY_ANALYTICS = gql`
  query CountryAnalytics($countryCode: String!, $period: DateRangeInput!, $tenantId: ID) {
    countryAnalytics(countryCode: $countryCode, period: $period, tenantId: $tenantId) {
      country
      countryCode
      kpis {
        activeUsers
        activeUsersDelta
        newSignups
        newSignupsDelta
        completions
        completionsDelta
        certsIssued
      }
      cities {
        city
        region
        totalUsers
        activeUsers
        completions
      }
      deviceBreakdown {
        web
        ios
        android
        webPct
        iosPct
        androidPct
      }
      topLearners {
        userId
        displayName
        city
        points
        pathsDone
        certs
      }
    }
  }
`;

export const COMPARE_COUNTRIES = gql`
  query CompareCountries($countryCodes: [String!]!, $period: DateRangeInput!, $tenantId: ID) {
    compareCountries(countryCodes: $countryCodes, period: $period, tenantId: $tenantId) {
      countries {
        country
        countryCode
        activeUsers
        avgTimePerUser
        completionRate
        topDomain
        topCity
        certsIssued
        avgQuizScore
      }
    }
  }
`;

export const LIVE_ACTIVITY = gql`
  query LiveActivity($tenantId: ID, $limit: Int, $countryCode: String) {
    liveActivity(tenantId: $tenantId, limit: $limit, countryCode: $countryCode) {
      userId
      userName
      city
      country
      action
      contentTitle
      timestamp
    }
  }
`;

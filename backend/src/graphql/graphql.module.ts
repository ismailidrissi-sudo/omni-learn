import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { GeoAnalyticsGqlService } from './geo-graphql.service';
import { GeoGqlResolver } from './geo.resolver';
import { GqlJwtAuthGuard } from '../auth/guards/gql-jwt-auth.guard';
import { GqlRbacGuard } from '../auth/guards/gql-rbac.guard';
import './geo-graphql.enums';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AnalyticsModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
    }),
  ],
  providers: [GeoAnalyticsGqlService, GeoGqlResolver, GqlJwtAuthGuard, GqlRbacGuard],
})
export class AppGraphqlModule {}

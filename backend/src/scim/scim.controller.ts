import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ScimService } from './scim.service';

/**
 * SCIM 2.0 Controller — Bulk provisioning
 * Endpoints: /scim/v2/Users, /scim/v2/Groups
 * Auth: Bearer token from IdP (e.g. Azure AD, Okta)
 */
@Controller('scim/v2')
export class ScimController {
  constructor(private readonly scim: ScimService) {}

  @Get('Users')
  async listUsers(
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scim.listUsers(filter, startIndex ? +startIndex : undefined, count ? +count : undefined);
  }

  @Post('Users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() body: Record<string, unknown>) {
    return this.scim.createUser(body as { userName: string; externalId?: string; [k: string]: unknown });
  }

  @Get('Users/:id')
  async getUser(@Param('id') id: string) {
    return this.scim.getUser(id);
  }

  @Put('Users/:id')
  async replaceUser(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.scim.updateUser(id, body);
  }

  @Patch('Users/:id')
  async patchUser(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const ops = (body.Operations as { op: string; path?: string; value?: unknown }[]) ?? [];
    const merged: Record<string, unknown> = {};
    for (const op of ops) {
      if (op.op === 'replace' && op.value) Object.assign(merged, op.value);
      if (op.op === 'add' && op.path && op.value) merged[op.path.replace('urn:ietf:params:scim:schemas:core:2.0:User:', '')] = op.value;
    }
    return this.scim.updateUser(id, merged);
  }

  @Delete('Users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string, @Res() res: Response) {
    await this.scim.deleteUser(id);
    return res.send();
  }

  @Get('Groups')
  async listGroups(
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scim.listGroups(filter, startIndex ? +startIndex : undefined, count ? +count : undefined);
  }

  @Post('Groups')
  @HttpCode(HttpStatus.CREATED)
  async createGroup(@Body() body: { displayName: string; externalId?: string; members?: { value: string }[] }) {
    return this.scim.createGroup(body);
  }

  @Get('ServiceProviderConfig')
  serviceProviderConfig() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      bulk: { supported: false },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [{ name: 'Bearer', description: 'OAuth Bearer', primary: true }],
    };
  }

  @Get('ResourceTypes')
  resourceTypes() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
      Resources: [
        { schema: 'urn:ietf:params:scim:schemas:core:2.0:User', id: 'User', name: 'User', endpoint: '/Users' },
        { schema: 'urn:ietf:params:scim:schemas:core:2.0:Group', id: 'Group', name: 'Group', endpoint: '/Groups' },
      ],
    };
  }

  @Get('provisioning-logs')
  getProvisioningLogs(@Query('limit') limit?: string) {
    return this.scim.getProvisioningLogs(limit ? +limit : 50);
  }
}

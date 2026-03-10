/**
 * omnilearn.space — RBAC Roles
 * Role-Based Access Control | Afflatus Consulting Group
 */

export enum RbacRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  COMPANY_MANAGER = 'COMPANY_MANAGER',
  INSTRUCTOR = 'INSTRUCTOR',
  CONTENT_MODERATOR = 'CONTENT_MODERATOR',
  LEARNER_PRO = 'LEARNER_PRO',
  LEARNER_BASIC = 'LEARNER_BASIC',
}

export const RBAC_ROLES = {
  [RbacRole.SUPER_ADMIN]: {
    role: 'Super Admin',
    color: '#6B4E9A',
    permissions:
      'Full platform control, tenant management, system config, create/manage all learning paths',
  },
  [RbacRole.COMPANY_ADMIN]: {
    role: 'Company Admin',
    color: '#8B6BB8',
    permissions:
      'Manage company users, assign learning paths to teams, view company analytics, configure branding',
  },
  [RbacRole.COMPANY_MANAGER]: {
    role: 'Company Manager',
    color: '#8D8D8D',
    permissions:
      'Monitor team progress on paths, approve enrollments, export reports, manage groups',
  },
  [RbacRole.INSTRUCTOR]: {
    role: 'Instructor',
    color: '#6B4E9A',
    permissions:
      'Create/edit courses, contribute content to paths, moderate discussions, view learner analytics',
  },
  [RbacRole.CONTENT_MODERATOR]: {
    role: 'Content Moderator',
    color: '#8B6BB8',
    permissions:
      'Review/approve UGC, moderate discussions, flag content, manage reported items',
  },
  [RbacRole.LEARNER_PRO]: {
    role: 'Learner (Pro)',
    color: '#6B4E9A',
    permissions:
      'Access all learning paths, join discussions, earn certificates, track progress',
  },
  [RbacRole.LEARNER_BASIC]: {
    role: 'Learner (Basic)',
    color: '#8D8D8D',
    permissions:
      'Access assigned paths only, basic micro-learning, restricted document access',
  },
} as const;

/**
 * omnilearn.space — Content Types
 * 8 specific content types with metadata fields | Afflatus Consulting Group
 */

export enum ContentType {
  COURSE = 'COURSE',
  MICRO_LEARNING = 'MICRO_LEARNING',
  PODCAST = 'PODCAST',
  DOCUMENT = 'DOCUMENT',
  IMPLEMENTATION_GUIDE = 'IMPLEMENTATION_GUIDE',
  QUIZ_ASSESSMENT = 'QUIZ_ASSESSMENT',
  GAME = 'GAME',
  VIDEO = 'VIDEO',
}

/** Type-specific metadata schemas for each content type — brand palette */
export const CONTENT_TYPE_METADATA = {
  [ContentType.COURSE]: {
    icon: '📚',
    color: '#6B4E9A',
    fields: ['scormPackageUrl', 'xapiEndpoint', 'sections', 'totalDuration'],
  },
  [ContentType.MICRO_LEARNING]: {
    icon: '⚡',
    color: '#8B6BB8',
    fields: ['targetDurationMinutes', 'slides', 'interactiveElements'],
  },
  [ContentType.PODCAST]: {
    icon: '🎧',
    color: '#6B4E9A',
    fields: ['audioUrl', 'transcriptUrl', 'episodeNumber', 'season', 'hosts'],
  },
  [ContentType.DOCUMENT]: {
    icon: '📄',
    color: '#8D8D8D',
    fields: ['fileUrl', 'fileType', 'pageCount', 'version'],
  },
  [ContentType.IMPLEMENTATION_GUIDE]: {
    icon: '🛠️',
    color: '#5A5A5A',
    fields: ['steps', 'templates', 'checklist', 'estimatedHours'],
  },
  [ContentType.QUIZ_ASSESSMENT]: {
    icon: '✅',
    color: '#6B4E9A',
    fields: ['questions', 'passingScore', 'timeLimitMinutes', 'attemptsAllowed'],
  },
  [ContentType.GAME]: {
    icon: '🎮',
    color: '#8B6BB8',
    fields: ['gameType', 'levels', 'scoringRules', 'leaderboardEnabled'],
  },
  [ContentType.VIDEO]: {
    icon: '🎬',
    color: '#8D8D8D',
    fields: ['hlsUrl', 'thumbnailUrl', 'chapters', 'subtitleTracks'],
  },
} as const;

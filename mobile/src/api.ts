/**
 * Learn! Mobile — API client
 * omnilearn.space | Afflatus Consulting Group
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export async function getPathSuggestions(userId: string) {
  const res = await fetch(`${API_URL}/intelligence/path-suggestions?userId=${userId}`);
  return res.json();
}

export async function semanticSearch(query: string) {
  const res = await fetch(`${API_URL}/intelligence/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function getRecommendations(userId: string, query?: string) {
  const url = new URL(`${API_URL}/intelligence/recommendations`);
  url.searchParams.set('userId', userId);
  if (query) url.searchParams.set('query', query);
  const res = await fetch(url.toString());
  return res.json();
}

export async function getLearningPaths() {
  const res = await fetch(`${API_URL}/learning-paths`);
  return res.json();
}

// ── Assigned content & Microlearnings ──

export async function getAssignedContent(userId: string) {
  const res = await fetch(`${API_URL}/users/${userId}/assigned-content`);
  return res.json();
}

export async function getMicrolearningFeed(userId: string, limit = 20, offset = 0) {
  const res = await fetch(
    `${API_URL}/microlearning/feed?userId=${userId}&limit=${limit}&offset=${offset}`,
  );
  return res.json();
}

export async function toggleMicrolearningLike(contentId: string, userId: string) {
  const res = await fetch(`${API_URL}/microlearning/${contentId}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function getMicrolearningComments(contentId: string) {
  const res = await fetch(`${API_URL}/microlearning/${contentId}/comments`);
  return res.json();
}

export async function addMicrolearningComment(contentId: string, userId: string, body: string) {
  const res = await fetch(`${API_URL}/microlearning/${contentId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, body }),
  });
  return res.json();
}

export async function recordMicrolearningShare(contentId: string, userId: string) {
  const res = await fetch(`${API_URL}/microlearning/${contentId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

// ── Trending & Content (for main page) ──

export async function getTrendingMicrolearnings(limit = 4) {
  const res = await fetch(
    `${API_URL}/microlearning/feed?userId=anonymous&limit=${limit}&offset=0`,
  );
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getTrendingCourses(limit = 3) {
  const res = await fetch(`${API_URL}/content?type=COURSE`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];
  return arr.slice(0, limit);
}

export async function getContent(id: string, userId?: string) {
  const url = userId
    ? `${API_URL}/content/${id}?userId=${userId}`
    : `${API_URL}/content/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Content not found');
  return res.json();
}

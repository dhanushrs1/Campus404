/**
 * curriculum/api.js — Campus404
 * Shared API helpers for the curriculum admin pages.
 * All calls attach the auth token. Throws a readable Error on failure.
 */

import { API_URL } from '../../../config';

const token = () => localStorage.getItem('token');
const auth  = () => ({ Authorization: `Bearer ${token()}` });
const BASE   = API_URL;

async function req(method, url, body) {
  const isFormData = body instanceof FormData;
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: isFormData ? auth() : { ...auth(), 'Content-Type': 'application/json' },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.detail || data?.message || raw || `Request failed (${res.status})`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  return data;
}

export const api = {
  // Labs
  getLabs:      (params = {}) => req('GET', `/labs?${new URLSearchParams(params)}`),
  getLab:       (id)          => req('GET', `/labs/${id}`),
  createLab:    (body)        => req('POST', '/labs', body),
  updateLab:    (id, body)    => req('PATCH', `/labs/${id}`, body),
  deleteLab:    (id)          => req('DELETE', `/labs/${id}`),

  // Modules
  getModules:    (labId)       => req('GET', `/modules?lab_id=${labId}`),
  getModule:     (id)          => req('GET', `/modules/${id}`),
  createModule:  (body)        => req('POST', '/modules', body),
  updateModule:  (id, body)    => req('PATCH', `/modules/${id}`, body),
  deleteModule:  (id)          => req('DELETE', `/modules/${id}`),

  // Challenges
  getChallenges:  (moduleId)   => req('GET', `/challenges?module_id=${moduleId}`),
  getChallenge:   (id)         => req('GET', `/challenges/${id}`),
  createChallenge:(body)       => req('POST', '/challenges', body),
  updateChallenge:(id, body)   => req('PATCH', `/challenges/${id}`, body),
  deleteChallenge:(id)         => req('DELETE', `/challenges/${id}`),
  replaceChallengeFiles: (id, files) => req('PUT', `/challenges/${id}/files`, files),

  // Utilities
  getLanguages: ()             => req('GET', '/languages'),

  // Upload
  uploadFile: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return req('POST', '/upload', fd);
  },

  // Guide (custom page type)
  getGuidePages: (params = {}) => {
    const query = new URLSearchParams(params);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return req('GET', `/admin/guide${suffix}`);
  },
  getGuidePage: (id) => req('GET', `/admin/guide/${id}`),
  createGuidePage: (body) => req('POST', '/admin/guide', body),
  updateGuidePage: (id, body) => req('PATCH', `/admin/guide/${id}`, body),
  deleteGuidePage: (id) => req('DELETE', `/admin/guide/${id}`),
  getGuidePageBySlug: (slug) => req('GET', `/guide/${slug}`),

  // Student workspace
  runWorkspaceLevel: (challengeId, body) => req('POST', `/workspace/levels/${challengeId}/run`, body),
  submitWorkspaceLevel: (challengeId, body) => req('POST', `/workspace/levels/${challengeId}/submit`, body),

  // Progression gate
  getModuleGate: (moduleId) => req('GET', `/modules/${moduleId}/gate`),
};

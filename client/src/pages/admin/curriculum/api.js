/**
 * curriculum/api.js — Campus404
 * Shared API helpers for the curriculum admin pages.
 * All calls attach the auth token. Throws a readable Error on failure.
 */

const token = () => localStorage.getItem('token');
const auth  = () => ({ Authorization: `Bearer ${token()}` });
const BASE   = '/api';

async function req(method, url, body) {
  const isFormData = body instanceof FormData;
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: isFormData ? auth() : { ...auth(), 'Content-Type': 'application/json' },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
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
};

const STORAGE_KEY = "campus404_completed_exercises";

function parseCompletedIds(raw) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function writeCompletedIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function getCompletedExerciseIds() {
  return parseCompletedIds(localStorage.getItem(STORAGE_KEY));
}

export function isExerciseCompleted(exerciseId) {
  const normalized = Number(exerciseId);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    return false;
  }

  return getCompletedExerciseIds().includes(normalized);
}

export function setExerciseCompletion(exerciseId, completed) {
  const normalized = Number(exerciseId);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    return;
  }

  const current = new Set(getCompletedExerciseIds());
  if (completed) {
    current.add(normalized);
  } else {
    current.delete(normalized);
  }

  writeCompletedIds(Array.from(current));
}

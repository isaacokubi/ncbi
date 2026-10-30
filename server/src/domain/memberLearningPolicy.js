export function normaliseCourseLessons(lessons) {
  if (!Array.isArray(lessons)) return [];
  return lessons.slice(0, 100).map((lesson, index) => ({
    id: String(lesson?.id || lesson?._id || `lesson-${index + 1}`).slice(0, 80),
    title: String(lesson?.title || `Lesson ${index + 1}`).trim().slice(0, 180),
    description: String(lesson?.description || '').trim().slice(0, 1000)
  })).filter(lesson => lesson.title);
}
export function calculateLessonProgress(lessons, completedLessonIds = []) {
  const safeLessons = normaliseCourseLessons(lessons);
  const validIds = new Set(safeLessons.map(lesson => lesson.id));
  const completed = [...new Set((Array.isArray(completedLessonIds) ? completedLessonIds : []).map(String).filter(id => validIds.has(id)))];
  return { lessons: safeLessons.map(lesson => ({ ...lesson, completed: completed.includes(lesson.id) })), completedLessonIds: completed, totalLessons: safeLessons.length, progressPercent: safeLessons.length ? Math.round(completed.length / safeLessons.length * 100) : 0 };
}
export function setLessonCompletion(lessons, completedLessonIds, lessonId, completed) {
  const progress = calculateLessonProgress(lessons, completedLessonIds);
  if (!progress.lessons.some(lesson => lesson.id === lessonId)) return { valid: false, message: 'Lesson does not belong to this course' };
  const ids = new Set(progress.completedLessonIds);
  if (completed) ids.add(lessonId); else ids.delete(lessonId);
  return { valid: true, ...calculateLessonProgress(lessons, [...ids]) };
}

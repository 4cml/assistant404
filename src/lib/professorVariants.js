// src/lib/professorVariants.js
//
// منطق اختيار وتصفية "نسخة الدكتور الفعّالة" لمادة معينة.
// المدخل المتوقع هو كائن subject.json بعد قراءته (أو null إذا المادة ليس لها subject.json خاص).
//
// شكل الحقل المتوقع داخل subject.json (اختياري):
// {
//   "professorVariants": [
//     { "professorId": "prof-ahmad", "professorName": "د. أحمد", "active": true,  "lecturesFile": "lectures-prof-ahmad.json" },
//     { "professorId": "prof-ali",   "professorName": "د. علي",  "active": false, "lecturesFile": "lectures-prof-ali.json" }
//   ]
// }
//
// ⚠ توافق عكسي: أي مادة بدون هذا الحقل (أو الحقل فاضي) تستمر تعمل بنفس طريقة lectures.json
// الحالية بدون أي تغيير — هذه الدالة لا تكسر شيء قائم.

/**
 * يتحقق هل هذه المادة تدعم تعدد الدكاترة أصلاً (فيها professorVariants غير فاضية).
 * @param {object|null} subjectData - محتوى subject.json (أو null)
 * @returns {boolean}
 */
export function hasProfessorVariants(subjectData) {
  return !!(
    subjectData &&
    Array.isArray(subjectData.professorVariants) &&
    subjectData.professorVariants.length > 0
  );
}

/**
 * يرجع النسخة (variant) الفعّالة، أو null إذا المادة لا تدعم تعدد الدكاترة (توافق عكسي).
 *
 * حالة استثنائية: إذا فيه professorVariants لكن ولا وحدة منها active:true (خطأ بيانات محتمل
 * من لوحة التحكم)، نرجع أول عنصر بدل ما نعرض صفحة فاضية للطالب.
 *
 * @param {object|null} subjectData
 * @returns {{professorId: string, professorName: string, active: boolean, lecturesFile: string}|null}
 */
export function getActiveVariant(subjectData) {
  if (!hasProfessorVariants(subjectData)) return null;

  const active = subjectData.professorVariants.find((v) => v.active === true);
  if (active) return active;

  // fallback آمن: ما في نسخة مفعّلة بالغلط → نعرض أول نسخة بدل صفحة فاضية
  return subjectData.professorVariants[0];
}

/**
 * يرجع كل النسخ المتاحة لمادة معينة (يفيد لوحة تحكم العضو 1 لعرض/تبديل الدكتور الفعّال).
 * @param {object|null} subjectData
 * @returns {Array}
 */
export function getAllVariants(subjectData) {
  if (!hasProfessorVariants(subjectData)) return [];
  return subjectData.professorVariants;
}

/**
 * يرجع اسم ملف المحاضرات الصحيح اللي لازم يُقرأ لهذه المادة:
 * - إذا فيه نسخة فعّالة ومعها lecturesFile محدد → نرجعه
 * - غير هيك (لا يوجد professorVariants، أو الحقل ناقص) → "lectures.json" الافتراضي
 *
 * هذا هو مدخل التوافق العكسي الأساسي: أي مادة قديمة تستمر بنفس السلوك الحالي تماماً.
 *
 * @param {object|null} subjectData
 * @returns {string} اسم الملف (بدون مسار المجلد)
 */
export function resolveLecturesFile(subjectData) {
  const active = getActiveVariant(subjectData);
  if (active && active.lecturesFile) return active.lecturesFile;
  return "lectures.json";
}
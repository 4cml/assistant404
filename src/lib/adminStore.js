/**
 * adminStore.js
 * -----------------------------------------------------------------------
 * منطق القراءة/الكتابة لبيانات لوحة التحكم الإدارية (Admin Panel).
 *
 * ⚠️ افتراضات مبدئية (لأنني لم أطّلع على الملفات الفعلية بعد):
 *   1. كل مادة مخزّنة بمجلد: public/subjects/{subjectId}/subject.json
 *   2. المحاضرات: public/subjects/{subjectId}/lectures.json
 *      (أو lectures-{professorId}.json حسب مخطط العضو 2 لاحقاً)
 *   3. قائمة المواد الكلية تُقرأ من: public/study-plan.json
 *   4. حقل "hidden": true/false موحّد على مستوى (مادة / قسم / عنصر محاضرة)
 *      حسب ما ورد في خطة الفريق — يجب التأكد من هذا مع العضو 4.
 *   5. بما أن الموقع Static (بدون خادم)، لا يوجد كتابة مباشرة على القرص.
 *      كل "حفظ" هنا يعني: تحديث نسخة الحالة في الذاكرة (in-memory state)
 *      ثم توليد ملف JSON جاهز للتنزيل ليضعه صاحب المشروع يدوياً في مكانه.
 *
 * عدّل هذه الافتراضات فور تأكيدها من العضو 4 (schema) والعضو 2 (professorVariants).
 * -----------------------------------------------------------------------
 */

// ------------------------------------------------------------------
// 1) تحميل البيانات (قراءة فقط من الملفات العامة)
// ------------------------------------------------------------------

/**
 * يجلب قائمة المواد الكاملة من study-plan.json
 * @returns {Promise<Array>} قائمة المواد بصيغتها الخام
 */
export async function loadStudyPlan() {
  const res = await fetch("/study-plan.json");
  if (!res.ok) throw new Error("تعذر تحميل study-plan.json");
  return res.json();
}

/**
 * يجلب ملف subject.json لمادة معينة
 * @param {string} subjectId
 */
export async function loadSubject(subjectId) {
  const res = await fetch(`/subjects/${subjectId}/subject.json`);
  if (!res.ok) throw new Error(`تعذر تحميل subject.json لـ ${subjectId}`);
  return res.json();
}

/**
 * يجلب ملف المحاضرات لمادة معينة (أو لدكتور محدد إن وُجد professorVariants)
 * @param {string} subjectId
 * @param {string} [lecturesFile] اسم الملف إن كان مختلفاً عن lectures.json الافتراضي
 */
export async function loadLectures(subjectId, lecturesFile = "lectures.json") {
  const res = await fetch(`/subjects/${subjectId}/${lecturesFile}`);
  if (!res.ok) throw new Error(`تعذر تحميل ${lecturesFile} لـ ${subjectId}`);
  return res.json();
}

// ------------------------------------------------------------------
// 2) الحالة الداخلية للوحة (in-memory) + دفتر التغييرات (changeset)
// ------------------------------------------------------------------

let state = {
  studyPlan: null,       // نسخة معدَّلة من study-plan.json
  subjectsCache: {},     // { [subjectId]: subjectJsonObject }
  lecturesCache: {},     // { [cacheKey]: lecturesJsonObject }
  dirty: new Set(),      // مفاتيح الملفات التي تغيّرت ولم تُصدَّر بعد
};

export function getState() {
  return state;
}

function markDirty(key) {
  state.dirty.add(key);
}

// ------------------------------------------------------------------
// 3) عمليات على المواد (Subjects)
// ------------------------------------------------------------------

/**
 * إضافة مادة جديدة (تولّد subject.json + lectures.json فاضي كنموذج)
 * @param {{id: string, name: string, section?: string}} newSubjectInfo
 */
export function addSubject({ id, name, section = "نظري" }) {
  if (state.subjectsCache[id]) {
    throw new Error(`المادة بمعرّف "${id}" موجودة مسبقاً`);
  }

  const subjectJson = {
    id,
    name,
    section,
    hidden: false,
    lecturesFile: "lectures.json",
  };

  const lecturesJson = { subjectId: id, lectures: [] };

  state.subjectsCache[id] = subjectJson;
  state.lecturesCache[`${id}:lectures.json`] = lecturesJson;

  markDirty(`subjects/${id}/subject.json`);
  markDirty(`subjects/${id}/lectures.json`);

  return { subjectJson, lecturesJson };
}

/**
 * تبديل حالة الإخفاء لأي عنصر (مادة / قسم / محاضرة) بشكل موحّد.
 * @param {"subject"|"section"|"lecture"} type
 * @param {string} targetId
 * @param {boolean} hidden
 */
export function setHidden(type, targetId, hidden) {
  if (type === "subject") {
    const subj = state.subjectsCache[targetId];
    if (!subj) throw new Error(`مادة غير موجودة: ${targetId}`);
    subj.hidden = hidden;
    markDirty(`subjects/${targetId}/subject.json`);
    return subj;
  }

  // ملاحظة: منطق "section" و "lecture" يحتاج معرفة دقيقة لبنية
  // SECTION_LABELS وبنية lectures.json الفعليتين — يُستكمل بعد
  // مراجعة الملفات الحقيقية.
  throw new Error(`نوع غير مدعوم بعد: ${type}`);
}

/**
 * حذف مادة (يزيلها من الحالة الداخلية فقط؛ الحذف الفعلي من public/
 * يتم يدوياً من صاحب المشروع بعد المراجعة)
 */
export function deleteSubject(subjectId) {
  delete state.subjectsCache[subjectId];
  markDirty(`subjects/${subjectId}/subject.json`); // سيُصدَّر كـ "محذوف"
}

// ------------------------------------------------------------------
// 4) التصدير — بديل الحفظ المباشر (الموقع Static بدون خادم)
// ------------------------------------------------------------------

/**
 * يولّد ملفات JSON محدثة لكل ما تغيّر، جاهزة للتنزيل.
 * يعيد مصفوفة { filename, content } ليعرضها Admin UI كأزرار تنزيل
 * أو نص جاهز للنسخ.
 */
export function exportChanges() {
  const changes = [];

  for (const key of state.dirty) {
    if (key.endsWith("subject.json")) {
      const subjectId = key.split("/")[1];
      const data = state.subjectsCache[subjectId];
      changes.push({
        filename: key,
        content: data ? JSON.stringify(data, null, 2) : null, // null = حذف
      });
    } else if (key.endsWith("lectures.json")) {
      const subjectId = key.split("/")[1];
      const cacheKey = `${subjectId}:lectures.json`;
      changes.push({
        filename: key,
        content: JSON.stringify(state.lecturesCache[cacheKey], null, 2),
      });
    }
  }

  return changes;
}

/**
 * ينزّل التغييرات كملفات فعلية عبر المتصفح (زر "تنزيل")
 */
export function downloadChanges() {
  const changes = exportChanges();
  changes.forEach(({ filename, content }) => {
    if (content === null) return; // تخطي المحذوفات، تُعرض بنص تحذيري فقط
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\//g, "__"); // تسطيح المسار لاسم ملف صالح
    a.click();
    URL.revokeObjectURL(url);
  });
  state.dirty.clear();
}

/**
 * يصفّر الحالة بالكامل (مفيد عند إعادة تحميل اللوحة)
 */
export function resetState() {
  state = {
    studyPlan: null,
    subjectsCache: {},
    lecturesCache: {},
    dirty: new Set(),
  };
}
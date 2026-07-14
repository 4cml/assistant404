/**
 * adminStore.js
 * -----------------------------------------------------------------------
 * منطق القراءة/الكتابة لبيانات لوحة التحكم الإدارية (Admin Panel).
 *
 * ✅ هذه النسخة مبنية على الملفات الحقيقية اللي تم رفعها والتحقق منها مباشرة
 * (study-plan.json, subjects-index.json, lectures.json + هيكل public/ الفعلي
 * عبر أمر tree). النسخة السابقة كانت مبنية على افتراضات غلط بالكامل.
 *
 * البنية الحقيقية المؤكدة:
 *   - public/data/study-plan.json  → { years: [{ year, levels: [{ level,
 *     semesterLabel, courses?: [...], tracks?: {trackName: [...]}, totalHours }] }] }
 *     كل عنصر كورس: { id, name, code, hours, subjectSlug?, hidden? }
 *   - public/data/subjects-index.json → مصفوفة slugs للمواد اللي عندها
 *     محتوى فعلي مرفوع (public/pdf/{slug}/lectures.json موجود فعلاً)
 *   - public/pdf/{slug}/lectures.json → مصفوفة مسطّحة:
 *     [{ type: "theory"|"lab", title, file }, ...]  (بدون غلاف كائن)
 *   - لا يوجد subject.json منفصل لأي مادة إطلاقاً.
 *
 * ⚠️ حقلين غير موجودين فعلياً بأي ملف حقيقي حالياً، وهذي النسخة تضيفهم
 * كاقتراح تصميم مؤقت فقط (يحتاج تأكيد/تنسيق مع العضو 2 والعضو 4 قبل
 * الاعتماد النهائي):
 *   1. "hidden" على كائن الكورس بـ study-plan.json مباشرة (مو ملف منفصل،
 *      لأنه لا يوجد subject.json أصلاً لنضع الحقل فيه).
 *   2. "professorVariants" على نفس كائن الكورس بـ study-plan.json (بدل
 *      subject.json المفترض بالخطة الأصلية، لعدم وجوده فعلياً).
 *   كذلك "hidden" على مستوى المحاضرة الواحدة بـ lectures.json — إضافة جديدة
 *   غير موجودة حالياً، تحتاج تعديل مقابل بصفحة العرض (Subject.jsx) من
 *   العضو 4/2 حتى تُستبعد المحاضرات المخفية فعلياً بالعرض العام.
 *
 * ⚠️ لا نفترض وجود src/lib/paths.js أو دالة withBase — لم يتم التأكد من
 * وجودها. نستخدم import.meta.env.BASE_URL مباشرة (طريقة Vite القياسية،
 * تعمل بشكل مضمون بالتطوير والإنتاج تحت أي base مخصص).
 * -----------------------------------------------------------------------
 */

import {
  getGithubToken,
  fetchFileFromGitHub,
  commitFileToGitHub,
  validateJsonBeforeCommit,
} from "./githubSync";

const BASE = import.meta.env.BASE_URL; // مثال: "/assistant404/"

function assetUrl(relativePath) {
  // relativePath بدون "/" بالبداية، مثال: "data/study-plan.json"
  return `${BASE}${relativePath}`.replace(/\/{2,}/g, "/").replace(/^\/?/, "/");
}

// ------------------------------------------------------------------
// 1) تحميل البيانات (قراءة فقط من الملفات العامة)
// ------------------------------------------------------------------

export async function loadStudyPlan() {
  const res = await fetch(assetUrl("data/study-plan.json"));
  if (!res.ok) throw new Error("تعذر تحميل data/study-plan.json");
  return res.json();
}

export async function loadSubjectsIndex() {
  const res = await fetch(assetUrl("data/subjects-index.json"));
  if (!res.ok) throw new Error("تعذر تحميل data/subjects-index.json");
  return res.json();
}

export async function loadLectures(slug) {
  const res = await fetch(assetUrl(`pdf/${slug}/lectures.json`));
  if (!res.ok) throw new Error(`تعذر تحميل lectures.json لـ ${slug}`);
  return res.json();
}

// ------------------------------------------------------------------
// 2) الحالة الداخلية (in-memory) + دفتر التغييرات
// ------------------------------------------------------------------

let state = {
  studyPlan: null,
  subjectsIndex: [],
  lecturesCache: {}, // { [slug]: Array }
  dirty: new Set(),  // "study-plan" | `lectures:${slug}`
};

export function getState() {
  return state;
}

function markDirty(key) {
  state.dirty.add(key);
}

/**
 * يحمّل كل شي مرة وحدة ويخزّنه بالحالة الداخلية. يُستدعى أول ما تفتح
 * أي شاشة بلوحة التحكم.
 */
export async function initAdminData() {
  const [studyPlan, subjectsIndex] = await Promise.all([
    loadStudyPlan(),
    loadSubjectsIndex(),
  ]);
  state.studyPlan = studyPlan;
  state.subjectsIndex = subjectsIndex;
  return state;
}

// ------------------------------------------------------------------
// 3) تسطيح المواد للعرض بالقائمة (AdminHome)
// ------------------------------------------------------------------

/**
 * يحوّل بنية study-plan.json المتداخلة إلى مصفوفة مسطّحة سهلة العرض،
 * مع الاحتفاظ بموقع كل عنصر (سنة/مستوى/مسار تخصص إن وُجد).
 */
export function flattenCourses(studyPlan = state.studyPlan) {
  if (!studyPlan?.years) return [];
  const flat = [];

  for (const y of studyPlan.years) {
    for (const lvl of y.levels) {
      const pushCourse = (course, trackName = null) => {
        const contentSlug = course.subjectSlug || course.id;
        flat.push({
          ...course,
          year: y.year,
          level: lvl.level,
          semesterLabel: lvl.semesterLabel,
          track: trackName,
          hasContent: state.subjectsIndex.includes(contentSlug),
          contentSlug,
        });
      };

      if (Array.isArray(lvl.courses)) {
        lvl.courses.forEach((c) => pushCourse(c));
      }
      if (lvl.tracks) {
        Object.entries(lvl.tracks).forEach(([trackName, courses]) => {
          courses.forEach((c) => pushCourse(c, trackName));
        });
      }
    }
  }

  return flat;
}

/**
 * يرجّع كل الكائنات المرجعية (references) بالشجرة الأصلية اللي تطابق id
 * معيّن. قد يكون أكثر من موقع لو نفس الكورس مشترك بين عدة مسارات تخصص
 * (تكرار id مقصود بالبيانات الحقيقية، مثال: "0730511" بثلاث مسارات).
 * تعديل كل هذي النسخ معاً يبقيها متسقة.
 */
function findCourseRefs(courseId) {
  const refs = [];
  if (!state.studyPlan?.years) return refs;

  for (const y of state.studyPlan.years) {
    for (const lvl of y.levels) {
      if (Array.isArray(lvl.courses)) {
        lvl.courses.forEach((c) => {
          if (c.id === courseId) refs.push(c);
        });
      }
      if (lvl.tracks) {
        Object.values(lvl.tracks).forEach((courses) => {
          courses.forEach((c) => {
            if (c.id === courseId) refs.push(c);
          });
        });
      }
    }
  }
  return refs;
}

/**
 * يرجّع أول نسخة من كورس معيّن (لعرضها بنموذج التعديل) + عدد كل النسخ
 * المكرَّرة (لتنبيه المستخدم لو أكثر من مسار).
 */
export function getCourse(courseId) {
  const refs = findCourseRefs(courseId);
  if (refs.length === 0) return null;
  return { course: refs[0], occurrences: refs.length };
}

// ------------------------------------------------------------------
// 4) تعديل بيانات الكورس (اسم / رمز / ساعات / hidden / professorVariants)
// ------------------------------------------------------------------

export function updateCourseMeta(courseId, updates) {
  const refs = findCourseRefs(courseId);
  if (refs.length === 0) throw new Error(`كورس غير موجود: ${courseId}`);
  refs.forEach((c) => Object.assign(c, updates));
  markDirty("study-plan");
  return refs[0];
}

export function setCourseHidden(courseId, hidden) {
  return updateCourseMeta(courseId, { hidden });
}

/**
 * إضافة كورس جديد لمستوى (level) موجود ضمن سنة (year) موجودة.
 * لا يدعم الإضافة داخل tracks حالياً (يحتاج تحديد اسم المسار أيضاً،
 * أُبقيه لتوسعة لاحقة عند الحاجة الفعلية).
 */
export function addCourseToLevel({ year, level, id, name, code = "", hours = 3 }) {
  const y = state.studyPlan.years.find((yy) => yy.year === year);
  if (!y) throw new Error(`سنة غير موجودة: ${year}`);
  const lvl = y.levels.find((l) => l.level === level);
  if (!lvl) throw new Error(`مستوى غير موجود: ${level}`);
  if (!Array.isArray(lvl.courses)) lvl.courses = [];

  if (lvl.courses.some((c) => c.id === id)) {
    throw new Error(`يوجد كورس بنفس المعرّف مسبقاً بهذا المستوى: ${id}`);
  }

  const newCourse = { id, name, code, hours };
  lvl.courses.push(newCourse);
  markDirty("study-plan");
  return newCourse;
}

// ------------------------------------------------------------------
// 5) إدارة professorVariants (مقترح مؤقت — يُخزَّن على كائن الكورس نفسه
//    بـ study-plan.json، بانتظار تأكيد مكانه النهائي مع العضو 2/4)
// ------------------------------------------------------------------

function ensureVariantsArray(course) {
  if (!Array.isArray(course.professorVariants)) course.professorVariants = [];
  return course.professorVariants;
}

export function addProfessorVariant(courseId, variant) {
  const refs = findCourseRefs(courseId);
  if (refs.length === 0) throw new Error(`كورس غير موجود: ${courseId}`);
  const variants = ensureVariantsArray(refs[0]);

  if (variants.some((v) => v.professorId === variant.professorId)) {
    throw new Error(`الدكتور "${variant.professorId}" مضاف مسبقاً`);
  }

  const entry = {
    professorId: variant.professorId,
    professorName: variant.professorName,
    active: variants.length === 0,
    lecturesFile: variant.lecturesFile || `lectures-${variant.professorId}.json`,
  };
  variants.push(entry);

  // نطبّق نفس التغيير على كل النسخ المكرَّرة (لو الكورس بأكثر من مسار)
  refs.slice(1).forEach((c) => {
    ensureVariantsArray(c).push({ ...entry });
  });

  markDirty("study-plan");
  return variants;
}

export function setActiveProfessorVariant(courseId, professorId) {
  const refs = findCourseRefs(courseId);
  if (refs.length === 0) throw new Error(`كورس غير موجود: ${courseId}`);

  refs.forEach((c) => {
    const variants = ensureVariantsArray(c);
    variants.forEach((v) => {
      v.active = v.professorId === professorId;
    });
  });

  markDirty("study-plan");
  return ensureVariantsArray(refs[0]);
}

export function removeProfessorVariant(courseId, professorId) {
  const refs = findCourseRefs(courseId);
  if (refs.length === 0) throw new Error(`كورس غير موجود: ${courseId}`);

  refs.forEach((c) => {
    const variants = ensureVariantsArray(c);
    const removedWasActive = variants.find((v) => v.professorId === professorId)?.active;
    c.professorVariants = variants.filter((v) => v.professorId !== professorId);
    if (removedWasActive && c.professorVariants.length > 0) {
      c.professorVariants[0].active = true;
    }
  });

  markDirty("study-plan");
  return refs[0].professorVariants;
}

// ------------------------------------------------------------------
// 6) إدارة المحاضرات (lectures.json) — لمواد فيها محتوى فعلي فقط
// ------------------------------------------------------------------

/**
 * يجلب محاضرات مادة (من الكاش أو بتحميلها أول مرة)، ويربطها بمفتاح
 * التتبع (dirty tracking) عشان أي تعديل عليها بعدين يُصدَّر صح.
 */
export async function getOrLoadLectures(slug) {
  if (state.lecturesCache[slug]) return state.lecturesCache[slug];
  const data = await loadLectures(slug);
  state.lecturesCache[slug] = data;
  return data;
}

/**
 * @param {"theory"|"lab"|"extra"|"exam"} type
 */
export function addLecture(slug, { type, title, file }) {
  const lectures = state.lecturesCache[slug];
  if (!lectures) throw new Error(`لم تُحمَّل محاضرات ${slug} بعد`);
  lectures.push({ type, title, file, hidden: false });
  markDirty(`lectures:${slug}`);
  return lectures;
}

export function setLectureHidden(slug, index, hidden) {
  const lectures = state.lecturesCache[slug];
  if (!lectures || !lectures[index]) throw new Error("محاضرة غير موجودة");
  lectures[index].hidden = hidden;
  markDirty(`lectures:${slug}`);
  return lectures[index];
}

export function removeLecture(slug, index) {
  const lectures = state.lecturesCache[slug];
  if (!lectures || !lectures[index]) throw new Error("محاضرة غير موجودة");
  lectures.splice(index, 1);
  markDirty(`lectures:${slug}`);
  return lectures;
}

// ------------------------------------------------------------------
// 7) أدوات مساعدة عامة
// ------------------------------------------------------------------

export function generateSlug(rawName) {
  return rawName
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ------------------------------------------------------------------
// 8) التصدير — بديل الحفظ المباشر (الموقع Static بدون خادم)
// ------------------------------------------------------------------

export function exportChanges() {
  const changes = [];

  for (const key of state.dirty) {
    if (key === "study-plan") {
      changes.push({
        filename: "public/data/study-plan.json",
        content: JSON.stringify(state.studyPlan, null, 2),
      });
    } else if (key.startsWith("lectures:")) {
      const slug = key.slice("lectures:".length);
      changes.push({
        filename: `public/pdf/${slug}/lectures.json`,
        content: JSON.stringify(state.lecturesCache[slug], null, 2),
      });
    }
  }

  return changes;
}

export function downloadChanges() {
  const changes = exportChanges();
  changes.forEach(({ filename, content }) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\//g, "__");
    a.click();
    URL.revokeObjectURL(url);
  });
  state.dirty.clear();
}

/**
 * يحدد schema المطابق لاسم ملف، لتمريره لـ validateJsonBeforeCommit.
 */
function schemaTypeForFilename(filename) {
  if (filename.endsWith("study-plan.json")) return "study-plan";
  if (filename.endsWith("lectures.json")) return "lectures";
  return null;
}

/**
 * الحفظ الموحّد: يحاول commit مباشر بـ GitHub لو فيه توكن، وإلا (أو لو فشل
 * الاتصال) يرجع تلقائياً لآلية "تنزيل JSON يدوي" كـ fallback آمن.
 *
 * @param {(status: string) => void} onStatus استدعاء تحديثات الحالة للواجهة
 * @returns {Promise<{mode: "github"|"download", results?: any[]}>}
 */
export async function saveChanges(onStatus = () => {}) {
  const token = getGithubToken();
  const changes = exportChanges();

  if (changes.length === 0) {
    onStatus("لا توجد تغييرات للحفظ.");
    return { mode: "none" };
  }

  if (!token) {
    onStatus("لا يوجد توكن — جاري التنزيل اليدوي بدل النشر المباشر...");
    downloadChanges();
    onStatus("تم تنزيل الملفات. ضعها بمكانها يدوياً وارفعها بـ commit.");
    return { mode: "download" };
  }

  onStatus("جاري الحفظ...");
  const results = [];

  try {
    for (const { filename, content } of changes) {
      const schemaType = schemaTypeForFilename(filename);
      if (schemaType) {
        const { valid, error } = validateJsonBeforeCommit(content, schemaType);
        if (!valid) {
          throw new Error(`فشل التحقق من "${filename}" قبل الحفظ: ${error}`);
        }
      }

      onStatus(`جاري جلب النسخة الحالية لـ ${filename}...`);
      const { sha } = await fetchFileFromGitHub(filename, token);

      onStatus(`جاري رفع ${filename}...`);
      const result = await commitFileToGitHub(
        filename,
        content,
        sha,
        token,
        `chore(admin): تحديث ${filename} عبر لوحة التحكم`
      );
      results.push(result);
    }

    state.dirty.clear();
    onStatus("تم الحفظ، جاري النشر (قد يستغرق دقيقة أو دقيقتين)...");
    return { mode: "github", results };
  } catch (err) {
    onStatus(`فشل النشر المباشر: ${err.message} — جاري التنزيل اليدوي كبديل...`);
    downloadChanges();
    onStatus("تم تنزيل الملفات كبديل. ضعها بمكانها يدوياً وارفعها بـ commit.");
    throw err;
  }
}

export function resetState() {
  state = {
    studyPlan: null,
    subjectsIndex: [],
    lecturesCache: {},
    dirty: new Set(),
  };
}
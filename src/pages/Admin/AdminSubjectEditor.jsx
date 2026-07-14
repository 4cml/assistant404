import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  initAdminData,
  getCourse,
  updateCourseMeta,
  setCourseHidden,
  addCourseToLevel,
  generateSlug,
  addProfessorVariant,
  setActiveProfessorVariant,
  removeProfessorVariant,
  getOrLoadLectures,
  addLecture,
  setLectureHidden,
  removeLecture,
  saveChanges,
  getState,
} from "../../lib/adminStore";
import AdminTokenGate from "./AdminTokenGate";
import "./AdminHome.css";

/**
 * AdminSubjectEditor.jsx
 * -----------------------------------------------------------------------
 * ✅ تصحيح مفاهيمي مهم عن النسخة السابقة: "القسم" (نظري/عملي/...) هنا
 * تصنيف لكل محاضرة على حدة (يطابق type بـ lectures.json الحقيقي)، مو
 * تصنيف للمادة كاملة كما كان بالنسخة القديمة الخاطئة.
 *
 * يخدم حالتين:
 *   - /admin/subjects/new           → إضافة كورس جديد لخطة دراسية
 *   - /admin/subjects/:subjectId    → تعديل كورس موجود + إدارة محاضراته
 *     (فقط لو عنده محتوى فعلي، أي موجود بـ subjects-index.json)
 * -----------------------------------------------------------------------
 */

const SECTION_LABELS_FALLBACK = {
  theory: "نظري",
  lab: "عملي",
  extra: "ملفات إضافية",
  exam: "أسئلة",
};

export default function AdminSubjectEditor() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const isNew = subjectId === "new" || !subjectId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [course, setCourse] = useState(null);
  const [occurrences, setOccurrences] = useState(1);
  const [lectures, setLectures] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState(null);

  // نموذج كورس جديد
  const [newYear, setNewYear] = useState(1);
  const [newLevel, setNewLevel] = useState(1);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newHours, setNewHours] = useState(3);

  // نموذج إضافة محاضرة
  const [lecType, setLecType] = useState("theory");
  const [lecTitle, setLecTitle] = useState("");
  const [lecFile, setLecFile] = useState("");

  // نموذج إضافة دكتور
  const [newProfId, setNewProfId] = useState("");
  const [newProfName, setNewProfName] = useState("");

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    initAdminData()
      .then(() => {
        const result = getCourse(subjectId);
        if (!result) throw new Error(`كورس غير موجود: ${subjectId}`);
        setCourse(result.course);
        setOccurrences(result.occurrences);
        if (result.course.hasContent !== false) {
          // نحاول تحميل المحاضرات فقط لو المادة عندها محتوى فعلي
          const slug = result.course.subjectSlug || result.course.id;
          return getOrLoadLectures(slug)
            .then((data) => setLectures(data))
            .catch(() => setLectures(null)); // ما عندها محتوى فعلي، عادي
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [subjectId, isNew]);

  const refreshDirtyCount = () => setPendingCount(getState().dirty.size);

  useEffect(() => {
    if (!slugEditedManually) setNewSlug(generateSlug(newName));
  }, [newName, slugEditedManually]);

  const sectionOptions = useMemo(() => Object.entries(SECTION_LABELS_FALLBACK), []);
  const contentSlug = course ? course.subjectSlug || course.id : null;

  function handleCreate(e) {
    e.preventDefault();
    setError(null);
    if (!newSlug) {
      setError("لازم يتولّد أو يُكتب معرّف (id) صالح — حروف/أرقام إنجليزية.");
      return;
    }
    try {
      const created = addCourseToLevel({
        year: Number(newYear),
        level: Number(newLevel),
        id: newSlug,
        name: newName,
        code: newCode,
        hours: Number(newHours),
      });
      refreshDirtyCount();
      navigate(`/admin/subjects/${created.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSaveMeta(e) {
    e.preventDefault();
    try {
      updateCourseMeta(subjectId, {
        name: course.name,
        code: course.code,
        hours: course.hours,
      });
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleToggleHidden() {
    try {
      const next = !course.hidden;
      setCourseHidden(subjectId, next);
      setCourse((c) => ({ ...c, hidden: next }));
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleAddLecture(e) {
    e.preventDefault();
    if (!lecTitle || !lecFile) {
      setError("لازم عنوان ومسار ملف قبل إضافة المحاضرة.");
      return;
    }
    try {
      const updated = addLecture(contentSlug, { type: lecType, title: lecTitle, file: lecFile });
      setLectures([...updated]);
      setLecTitle("");
      setLecFile("");
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleToggleLectureHidden(index) {
    try {
      setLectureHidden(contentSlug, index, !lectures[index].hidden);
      setLectures((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], hidden: !next[index].hidden };
        return next;
      });
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleRemoveLecture(index) {
    const confirmed = window.confirm(`حذف "${lectures[index].title}"؟`);
    if (!confirmed) return;
    try {
      const updated = removeLecture(contentSlug, index);
      setLectures([...updated]);
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleAddVariant(e) {
    e.preventDefault();
    if (!newProfId || !newProfName) {
      setError("لازم معرّف واسم الدكتور قبل الإضافة.");
      return;
    }
    try {
      const variants = addProfessorVariant(subjectId, { professorId: newProfId, professorName: newProfName });
      setCourse((c) => ({ ...c, professorVariants: variants }));
      setNewProfId("");
      setNewProfName("");
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSetActiveVariant(professorId) {
    try {
      const variants = setActiveProfessorVariant(subjectId, professorId);
      setCourse((c) => ({ ...c, professorVariants: variants }));
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleRemoveVariant(professorId) {
    if (!window.confirm("حذف نسخة هذا الدكتور؟")) return;
    try {
      const variants = removeProfessorVariant(subjectId, professorId);
      setCourse((c) => ({ ...c, professorVariants: variants }));
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSave() {
    try {
      await saveChanges(setSaveStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      refreshDirtyCount();
    }
  }

  if (loading) return <div className="admin-state">جارِ التحميل…</div>;

  return (
    <AdminTokenGate>
    <div className="admin-home">
      <header className="admin-home__header">
        <div>
          <h1>{isNew ? "كورس جديد" : `تعديل: ${course?.name || subjectId}`}</h1>
          <p className="admin-home__hint">
            هذه الأداة تعمل محلياً فقط. بعد التعديل استخدم "تنزيل التغييرات"
            من الصفحة الرئيسية، ثم ضع الملفات مكانها وارفعها بـ commit.
          </p>
        </div>
        <Link to="/admin" className="btn">← رجوع لقائمة الكورسات</Link>
      </header>

      {error && <div className="admin-state admin-state--error">{error}</div>}

      {isNew ? (
        <form onSubmit={handleCreate} className="admin-subject-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ flex: 1 }}>
              السنة
              <input type="number" min="1" className="btn" style={{ width: "100%", marginTop: 4 }} value={newYear} onChange={(e) => setNewYear(e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              المستوى
              <input type="number" min="1" className="btn" style={{ width: "100%", marginTop: 4 }} value={newLevel} onChange={(e) => setNewLevel(e.target.value)} />
            </label>
          </div>

          <label>
            اسم المادة
            <input className="btn" style={{ width: "100%", marginTop: 4 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثال: Database Systems" />
          </label>

          <label>
            المعرّف (id) — يُستخدم كاسم مجلد بـ public/pdf/ إذا أُضيف محتوى لاحقاً
            <input
              className="btn"
              style={{ width: "100%", marginTop: 4 }}
              value={newSlug}
              onChange={(e) => {
                setSlugEditedManually(true);
                setNewSlug(generateSlug(e.target.value));
              }}
              placeholder="database"
            />
          </label>

          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ flex: 1 }}>
              الرمز (code)
              <input className="btn" style={{ width: "100%", marginTop: 4 }} value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              الساعات
              <input type="number" min="1" className="btn" style={{ width: "100%", marginTop: 4 }} value={newHours} onChange={(e) => setNewHours(e.target.value)} />
            </label>
          </div>

          <p className="admin-home__hint">
            ملاحظة: هذا يضيف سطر الكورس بـ study-plan.json فقط. لو تبي محتوى
            فعلي (محاضرات PDF)، لازم تنشئ مجلد <code>public/pdf/{newSlug || "..."}/</code> يدوياً
            وتضيفه بـ <code>subjects-index.json</code> بعد الرفع.
          </p>

          <button type="submit" className="btn btn--primary">إنشاء الكورس</button>
        </form>
      ) : (
        <>
          {occurrences > 1 && (
            <div className="admin-empty" style={{ background: "rgba(217,119,6,0.1)", color: "#d97706", textAlign: "right", padding: 12 }}>
              ⚠️ هذا الكورس مشترك بين {occurrences} مسارات تخصص بنفس المستوى.
              أي تعديل هنا يُطبَّق على كل النسخ تلقائياً حتى تبقى متسقة.
            </div>
          )}

          <form onSubmit={handleSaveMeta} className="admin-subject-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
            <label>
              اسم المادة
              <input className="btn" style={{ width: "100%", marginTop: 4 }} value={course.name || ""} onChange={(e) => setCourse((c) => ({ ...c, name: e.target.value }))} />
            </label>

            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ flex: 1 }}>
                الرمز (code)
                <input className="btn" style={{ width: "100%", marginTop: 4 }} value={course.code || ""} onChange={(e) => setCourse((c) => ({ ...c, code: e.target.value }))} />
              </label>
              <label style={{ flex: 1 }}>
                الساعات
                <input type="number" className="btn" style={{ width: "100%", marginTop: 4 }} value={course.hours || 0} onChange={(e) => setCourse((c) => ({ ...c, hours: Number(e.target.value) }))} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn--primary">حفظ التعديلات</button>
              <button type="button" className="btn" onClick={handleToggleHidden}>
                {course.hidden ? "إظهار الكورس" : "إخفاء الكورس"}
              </button>
            </div>
          </form>

          {/* إدارة المحاضرات — فقط لو عندها محتوى فعلي */}
          <section className="admin-section-group">
            <h2 className="admin-section-group__title">المحاضرات</h2>

            {lectures === null ? (
              <p className="admin-home__hint">
                هذا الكورس ما عنده محتوى مرفوع بعد (غير موجود بـ subjects-index.json).
                لإضافة محاضرات، أنشئ مجلد <code>public/pdf/{contentSlug}/</code> يدوياً أولاً.
              </p>
            ) : (
              <>
                <ul className="admin-subject-list">
                  {lectures.map((lec, index) => (
                    <li key={index} className={`admin-subject-row ${lec.hidden ? "admin-subject-row--hidden" : ""}`}>
                      <div className="admin-subject-row__info">
                        <span className="badge" style={{ background: "rgba(37,99,235,0.1)", color: "#2563eb" }}>
                          {SECTION_LABELS_FALLBACK[lec.type] || lec.type}
                        </span>
                        <span className="admin-subject-row__name">{lec.title}</span>
                        {lec.hidden && <span className="badge badge--hidden">مخفية</span>}
                      </div>
                      <div className="admin-subject-row__actions">
                        <button className="btn btn--sm" onClick={() => handleToggleLectureHidden(index)}>
                          {lec.hidden ? "إظهار" : "إخفاء"}
                        </button>
                        <button className="btn btn--sm btn--danger" onClick={() => handleRemoveLecture(index)}>
                          حذف
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <form onSubmit={handleAddLecture} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <select className="btn" value={lecType} onChange={(e) => setLecType(e.target.value)}>
                    {sectionOptions.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <input className="btn" placeholder="عنوان المحاضرة" value={lecTitle} onChange={(e) => setLecTitle(e.target.value)} />
                  <input className="btn" placeholder={`pdf/${contentSlug}/theory/file.pdf`} value={lecFile} onChange={(e) => setLecFile(e.target.value)} style={{ minWidth: 260 }} />
                  <button type="submit" className="btn btn--accent">+ إضافة محاضرة</button>
                </form>
                <p className="admin-home__hint">
                  ملاحظة: حقل "hidden" على المحاضرة إضافة جديدة مقترحة — لازم
                  تنسيق مع صفحة العرض (Subject.jsx) حتى تستبعد المحاضرات
                  المخفية فعلياً، غير مطبَّق هناك حالياً.
                </p>
              </>
            )}
          </section>

          {/* professorVariants — مقترح مؤقت، مخزَّن على كائن الكورس بـ study-plan.json */}
          <section className="admin-section-group">
            <h2 className="admin-section-group__title">نسخ الدكاترة (Professor Variants)</h2>
            <p className="admin-home__hint">
              ⚠️ هذا الحقل غير موجود حالياً بأي ملف حقيقي بالمشروع — مخزَّن
              هنا مؤقتاً على كائن الكورس نفسه بـ study-plan.json، بانتظار
              تأكيد مكانه النهائي مع العضو 2 والعضو 4.
            </p>

            <ul className="admin-subject-list">
              {(course.professorVariants || []).map((v) => (
                <li key={v.professorId} className={`admin-subject-row ${v.active ? "" : "admin-subject-row--hidden"}`}>
                  <div className="admin-subject-row__info">
                    <span className="admin-subject-row__name">{v.professorName}</span>
                    <span className="admin-subject-row__id">{v.professorId}</span>
                    {v.active && <span className="badge" style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb" }}>فعّالة</span>}
                  </div>
                  <div className="admin-subject-row__actions">
                    {!v.active && (
                      <button className="btn btn--sm" onClick={() => handleSetActiveVariant(v.professorId)}>تفعيل</button>
                    )}
                    <button className="btn btn--sm btn--danger" onClick={() => handleRemoveVariant(v.professorId)}>حذف</button>
                  </div>
                </li>
              ))}
            </ul>

            <form onSubmit={handleAddVariant} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <input className="btn" placeholder="معرّف الدكتور (prof-ahmad)" value={newProfId} onChange={(e) => setNewProfId(e.target.value)} />
              <input className="btn" placeholder="اسم الدكتور (د. أحمد)" value={newProfName} onChange={(e) => setNewProfName(e.target.value)} />
              <button type="submit" className="btn btn--accent">+ إضافة دكتور</button>
            </form>
          </section>
        </>
      )}

      <div className="admin-home__toolbar">
        <button className="btn btn--accent" onClick={handleSave} disabled={pendingCount === 0}>
          حفظ ونشر ({pendingCount})
        </button>
      </div>

      {saveStatus && (
        <div className="admin-empty" style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb", textAlign: "right", padding: 10 }}>
          {saveStatus}
        </div>
      )}
    </div>
    </AdminTokenGate>
  );
}
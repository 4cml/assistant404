import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getOrLoadSubject,
  addSubject,
  updateSubjectMeta,
  setHidden,
  generateSlug,
  addProfessorVariant,
  setActiveProfessorVariant,
  removeProfessorVariant,
  getState,
} from "../../lib/adminStore";
import "./AdminHome.css";

/**
 * AdminSubjectEditor.jsx
 * -----------------------------------------------------------------------
 * شاشة واحدة تخدم حالتين حسب الرابط:
 *   - /admin/subjects/new       → إنشاء مادة جديدة
 *   - /admin/subjects/:subjectId → تعديل مادة موجودة
 *
 * ⚠️ SECTION_LABELS: لم أستورده من مسار مشترك (مثل src/lib/sectionLabels.js)
 * لأن مصدر هذه المعلومة غير مؤكد من الإدارة مباشرة. القائمة أدناه محلية
 * مؤقتاً لتفادي كسر البناء (build) إذا كان المسار أو الشكل غير دقيق.
 * بمجرد تأكيد المسار الفعلي من الإدارة، استبدل الثابت المحلي بـ:
 *   import { SECTION_LABELS } from "../../lib/sectionLabels";
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

  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  // حقول نموذج المادة الجديدة
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [newSection, setNewSection] = useState("theory");

  // حقول إضافة دكتور جديد
  const [newProfName, setNewProfName] = useState("");
  const [newProfId, setNewProfId] = useState("");

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getOrLoadSubject(subjectId)
      .then((data) => setSubject(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [subjectId, isNew]);

  const refreshDirtyCount = () => setPendingCount(getState().dirty.size);

  // توليد slug تلقائياً من الاسم، إلا لو المستخدم عدّله يدوياً
  useEffect(() => {
    if (!slugEditedManually) setNewSlug(generateSlug(newName));
  }, [newName, slugEditedManually]);

  function handleCreate(e) {
    e.preventDefault();
    setError(null);
    if (!newSlug) {
      setError("لازم يتولّد أو يُكتب معرّف (slug) صالح — استخدم حروف/أرقام إنجليزية.");
      return;
    }
    try {
      const { subjectJson } = addSubject({
        id: newSlug,
        name: newName,
        section: newSection,
      });
      refreshDirtyCount();
      navigate(`/admin/subjects/${subjectJson.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSaveMeta(e) {
    e.preventDefault();
    try {
      updateSubjectMeta(subjectId, {
        name: subject.name,
        section: subject.section,
      });
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleToggleHidden() {
    try {
      const next = !subject.hidden;
      setHidden("subject", subjectId, next);
      setSubject((s) => ({ ...s, hidden: next }));
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleAddVariant(e) {
    e.preventDefault();
    if (!newProfId || !newProfName) {
      setError("لازم تكتب معرّف واسم الدكتور قبل الإضافة.");
      return;
    }
    try {
      const variants = addProfessorVariant(subjectId, {
        professorId: newProfId,
        professorName: newProfName,
      });
      setSubject((s) => ({ ...s, professorVariants: variants }));
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
      setSubject((s) => ({ ...s, professorVariants: variants }));
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleRemoveVariant(professorId) {
    const confirmed = window.confirm("حذف نسخة هذا الدكتور من المادة؟");
    if (!confirmed) return;
    try {
      const variants = removeProfessorVariant(subjectId, professorId);
      setSubject((s) => ({ ...s, professorVariants: variants }));
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  const sectionOptions = useMemo(
    () => Object.entries(SECTION_LABELS_FALLBACK),
    []
  );

  if (loading) return <div className="admin-state">جارِ التحميل…</div>;

  return (
    <div className="admin-home">
      <header className="admin-home__header">
        <div>
          <h1>{isNew ? "مادة جديدة" : `تعديل: ${subject?.name || subjectId}`}</h1>
          <p className="admin-home__hint">
            هذه الأداة تعمل محلياً فقط. بعد التعديل استخدم "تنزيل التغييرات"
            من الصفحة الرئيسية، ثم ضع الملفات مكانها وارفعها بـ commit.
          </p>
        </div>
        <Link to="/admin" className="btn">
          ← رجوع لقائمة المواد
        </Link>
      </header>

      {error && <div className="admin-state admin-state--error">{error}</div>}

      {isNew ? (
        <form onSubmit={handleCreate} className="admin-subject-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <label>
            اسم المادة
            <input
              className="btn"
              style={{ width: "100%", marginTop: 4 }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مثال: Database Systems"
            />
          </label>

          <label>
            المعرّف (slug) — يُستخدم كاسم مجلد بـ public/pdf/
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

          <label>
            القسم
            <select
              className="btn"
              style={{ width: "100%", marginTop: 4 }}
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
            >
              {sectionOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="btn btn--primary">
            إنشاء المادة
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={handleSaveMeta} className="admin-subject-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
            <label>
              اسم المادة
              <input
                className="btn"
                style={{ width: "100%", marginTop: 4 }}
                value={subject.name || ""}
                onChange={(e) => setSubject((s) => ({ ...s, name: e.target.value }))}
              />
            </label>

            <label>
              القسم
              <select
                className="btn"
                style={{ width: "100%", marginTop: 4 }}
                value={subject.section || "theory"}
                onChange={(e) => setSubject((s) => ({ ...s, section: e.target.value }))}
              >
                {sectionOptions.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn--primary">
                حفظ التعديلات
              </button>
              <button type="button" className="btn" onClick={handleToggleHidden}>
                {subject.hidden ? "إظهار المادة" : "إخفاء المادة"}
              </button>
            </div>
          </form>

          <section className="admin-section-group">
            <h2 className="admin-section-group__title">نسخ الدكاترة (Professor Variants)</h2>

            {(!subject.professorVariants || subject.professorVariants.length === 0) && (
              <p className="admin-home__hint">
                لا توجد نسخ دكاترة لهذه المادة بعد — تعمل حالياً بملف lectures.json
                الافتراضي (توافق عكسي).
              </p>
            )}

            <ul className="admin-subject-list">
              {(subject.professorVariants || []).map((v) => (
                <li
                  key={v.professorId}
                  className={`admin-subject-row ${v.active ? "" : "admin-subject-row--hidden"}`}
                >
                  <div className="admin-subject-row__info">
                    <span className="admin-subject-row__name">{v.professorName}</span>
                    <span className="admin-subject-row__id">{v.professorId}</span>
                    {v.active && <span className="badge" style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb" }}>فعّالة</span>}
                  </div>
                  <div className="admin-subject-row__actions">
                    {!v.active && (
                      <button className="btn btn--sm" onClick={() => handleSetActiveVariant(v.professorId)}>
                        تفعيل
                      </button>
                    )}
                    <button className="btn btn--sm btn--danger" onClick={() => handleRemoveVariant(v.professorId)}>
                      حذف
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <form onSubmit={handleAddVariant} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <input
                className="btn"
                placeholder="معرّف الدكتور (مثال: prof-ahmad)"
                value={newProfId}
                onChange={(e) => setNewProfId(e.target.value)}
              />
              <input
                className="btn"
                placeholder="اسم الدكتور (مثال: د. أحمد)"
                value={newProfName}
                onChange={(e) => setNewProfName(e.target.value)}
              />
              <button type="submit" className="btn btn--accent">
                + إضافة دكتور
              </button>
            </form>
          </section>
        </>
      )}

      <div className="admin-home__toolbar">
        <Link to="/admin" className="btn">
          الذهاب لتنزيل التغييرات ({pendingCount})
        </Link>
      </div>
    </div>
  );
}
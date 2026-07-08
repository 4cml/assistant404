import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom"; // عدّل حسب مكتبة التوجيه الفعلية بالمشروع
import {
  loadStudyPlan,
  setHidden,
  deleteSubject,
  downloadChanges,
  getState,
} from "../../lib/adminStore";
import "./AdminHome.css";

/**
 * AdminHome.jsx
 * -----------------------------------------------------------------------
 * شاشة "قائمة كل المواد" — أول شاشة بلوحة التحكم.
 * تعرض كل مادة مع أزرار: تعديل / إخفاء / حذف، وزر عام لتنزيل التغييرات
 * (لأن الموقع Static بدون خادم — راجع القيد المعماري بخطة الفريق).
 *
 * ⚠️ يفترض هذا الملف بنية study-plan.json كمصفوفة مواد بالشكل:
 *   [{ id, name, section, hidden }, ...]
 * إن كانت البنية الفعلية مختلفة (مثلاً مجمّعة بحسب section)، يحتاج
 * تعديل بسيط بمنطق التجميع أدناه فقط — لا يمس بقية الملف.
 * -----------------------------------------------------------------------
 */

export default function AdminHome() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState("all"); // all | visible | hidden

  useEffect(() => {
    loadStudyPlan()
      .then((data) => setSubjects(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const refreshDirtyCount = () => setPendingCount(getState().dirty.size);

  const grouped = useMemo(() => {
    const bySection = {};
    for (const subj of subjects) {
      if (filter === "visible" && subj.hidden) continue;
      if (filter === "hidden" && !subj.hidden) continue;
      const key = subj.section || "غير مصنّف";
      if (!bySection[key]) bySection[key] = [];
      bySection[key].push(subj);
    }
    return bySection;
  }, [subjects, filter]);

  function handleToggleHidden(subject) {
    try {
      const next = !subject.hidden;
      setHidden("subject", subject.id, next);
      setSubjects((prev) =>
        prev.map((s) => (s.id === subject.id ? { ...s, hidden: next } : s))
      );
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDelete(subject) {
    const confirmed = window.confirm(
      `متأكد تبي تحذف "${subject.name}"؟ الحذف الفعلي من public/ يصير يدوياً بعد التنزيل ومراجعة العضو 4.`
    );
    if (!confirmed) return;
    deleteSubject(subject.id);
    setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
    refreshDirtyCount();
  }

  function handleDownload() {
    downloadChanges();
    refreshDirtyCount();
  }

  if (loading) return <div className="admin-state">جارِ التحميل…</div>;
  if (error)
    return (
      <div className="admin-state admin-state--error">
        حصل خطأ: {error}
      </div>
    );

  return (
    <div className="admin-home">
      <header className="admin-home__header">
        <div>
          <h1>لوحة التحكم — كل المواد</h1>
          <p className="admin-home__hint">
            هذه الأداة تعمل محلياً فقط. أي تعديل هنا يحتاج تنزيل الملفات
            ووضعها يدوياً بمكانها، ثم عمل commit.
          </p>
        </div>
        <div className="admin-home__actions">
          <Link to="/admin/subjects/new" className="btn btn--primary">
            + مادة جديدة
          </Link>
          <Link to="/admin/sections" className="btn">
            إدارة الأقسام
          </Link>
        </div>
      </header>

      <div className="admin-home__toolbar">
        <div className="admin-home__filters">
          {[
            ["all", "الكل"],
            ["visible", "الظاهرة فقط"],
            ["hidden", "المخفية فقط"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`chip ${filter === value ? "chip--active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className="btn btn--accent"
          onClick={handleDownload}
          disabled={pendingCount === 0}
        >
          تنزيل التغييرات {pendingCount > 0 ? `(${pendingCount})` : ""}
        </button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="admin-empty">
          لا توجد مواد تطابق هذا الفلتر.
        </div>
      )}

      {Object.entries(grouped).map(([sectionName, items]) => (
        <section key={sectionName} className="admin-section-group">
          <h2 className="admin-section-group__title">{sectionName}</h2>
          <ul className="admin-subject-list">
            {items.map((subject) => (
              <li
                key={subject.id}
                className={`admin-subject-row ${
                  subject.hidden ? "admin-subject-row--hidden" : ""
                }`}
              >
                <div className="admin-subject-row__info">
                  <span className="admin-subject-row__name">
                    {subject.name}
                  </span>
                  <span className="admin-subject-row__id">{subject.id}</span>
                  {subject.hidden && (
                    <span className="badge badge--hidden">مخفية</span>
                  )}
                </div>

                <div className="admin-subject-row__actions">
                  <Link
                    to={`/admin/subjects/${subject.id}`}
                    className="btn btn--sm"
                  >
                    تعديل
                  </Link>
                  <button
                    className="btn btn--sm"
                    onClick={() => handleToggleHidden(subject)}
                  >
                    {subject.hidden ? "إظهار" : "إخفاء"}
                  </button>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => handleDelete(subject)}
                  >
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
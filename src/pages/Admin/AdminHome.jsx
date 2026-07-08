import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  initAdminData,
  flattenCourses,
  setCourseHidden,
  downloadChanges,
  getState,
} from "../../lib/adminStore";
import "./AdminHome.css";

/**
 * AdminHome.jsx — قائمة كل الكورسات (مبنية على study-plan.json الحقيقي).
 *
 * ملاحظة مهمة: أغلب الكورسات بالخطة الدراسية (~50) ما عندها محتوى فعلي
 * مرفوع (مجرد سطر بالخطة الدراسية). بس 7 منها فيها فعلياً lectures.json
 * بمجلد public/pdf/. الشارة "بدون محتوى" تُبيّن هذا الفرق بوضوح.
 */

export default function AdminHome() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState("all"); // all | visible | hidden | withContent

  useEffect(() => {
    initAdminData()
      .then(() => setCourses(flattenCourses()))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const refreshDirtyCount = () => setPendingCount(getState().dirty.size);

  const grouped = useMemo(() => {
    const byLevel = {};
    for (const c of courses) {
      if (filter === "visible" && c.hidden) continue;
      if (filter === "hidden" && !c.hidden) continue;
      if (filter === "withContent" && !c.hasContent) continue;

      const key = `${c.semesterLabel}${c.track ? ` — ${c.track}` : ""}`;
      if (!byLevel[key]) byLevel[key] = [];
      byLevel[key].push(c);
    }
    return byLevel;
  }, [courses, filter]);

  function handleToggleHidden(course) {
    try {
      const next = !course.hidden;
      setCourseHidden(course.id, next);
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, hidden: next } : c))
      );
      refreshDirtyCount();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDownload() {
    downloadChanges();
    refreshDirtyCount();
  }

  if (loading) return <div className="admin-state">جارِ التحميل…</div>;
  if (error)
    return <div className="admin-state admin-state--error">حصل خطأ: {error}</div>;

  return (
    <div className="admin-home">
      <header className="admin-home__header">
        <div>
          <h1>لوحة التحكم — كل الكورسات</h1>
          <p className="admin-home__hint">
            هذه الأداة تعمل محلياً فقط. أي تعديل يحتاج تنزيل الملفات ووضعها
            يدوياً بمكانها، ثم عمل commit. الكورسات "بدون محتوى" هي مجرد
            سطر بالخطة الدراسية، ما فيها ملفات مرفوعة بعد.
          </p>
        </div>
        <Link to="/admin/subjects/new" className="btn btn--primary">
          + كورس جديد
        </Link>
      </header>

      <div className="admin-home__toolbar">
        <div className="admin-home__filters">
          {[
            ["all", "الكل"],
            ["withContent", "فيها محتوى فقط"],
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

        <button className="btn btn--accent" onClick={handleDownload} disabled={pendingCount === 0}>
          تنزيل التغييرات {pendingCount > 0 ? `(${pendingCount})` : ""}
        </button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="admin-empty">لا توجد كورسات تطابق هذا الفلتر.</div>
      )}

      {Object.entries(grouped).map(([groupLabel, items]) => (
        <section key={groupLabel} className="admin-section-group">
          <h2 className="admin-section-group__title">{groupLabel}</h2>
          <ul className="admin-subject-list">
            {items.map((course) => (
              <li
                key={`${course.id}-${course.track || ""}`}
                className={`admin-subject-row ${course.hidden ? "admin-subject-row--hidden" : ""}`}
              >
                <div className="admin-subject-row__info">
                  <span className="admin-subject-row__name">{course.name}</span>
                  <span className="admin-subject-row__id">{course.id}</span>
                  {!course.hasContent && (
                    <span className="badge" style={{ background: "rgba(107,114,128,0.15)", color: "#6b7280" }}>
                      بدون محتوى
                    </span>
                  )}
                  {course.hidden && <span className="badge badge--hidden">مخفية</span>}
                </div>

                <div className="admin-subject-row__actions">
                  <Link to={`/admin/subjects/${course.id}`} className="btn btn--sm">
                    تعديل
                  </Link>
                  <button className="btn btn--sm" onClick={() => handleToggleHidden(course)}>
                    {course.hidden ? "إظهار" : "إخفاء"}
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
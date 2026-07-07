import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function CoursesTable({ courses }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
      <thead>
        <tr style={{ background: "#f9fafb" }}>
          <th style={{ padding: 8, border: "1px solid #eee" }}>اسم المقرر</th>
          <th style={{ padding: 8, border: "1px solid #eee" }}>رمز المقرر</th>
          <th style={{ padding: 8, border: "1px solid #eee" }}>الساعات</th>
        </tr>
      </thead>
      <tbody>
        {courses.map((course, i) => (
          <tr key={i}>
            <td style={{ padding: 8, border: "1px solid #eee" }}>
              <Link to={`/subject/${course.subjectSlug || course.id}`} style={{ color: "#2563eb" }}>
                {course.name}
              </Link>
            </td>
            <td style={{ padding: 8, border: "1px solid #eee" }}>{course.code || "-"}</td>
            <td style={{ padding: 8, border: "1px solid #eee" }}>{course.hours}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LevelBlock({ lvl }) {
  const [open, setOpen] = useState(false);
  const [activeTrack, setActiveTrack] = useState(
    lvl.hasSpecializations ? Object.keys(lvl.tracks)[0] : null
  );

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: 10,
          background: "#fafafa",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          border: "1px solid #eee",
        }}
      >
        <span>{lvl.semesterLabel} — {lvl.totalHours} ساعة</span>
        <span>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ padding: 8 }}>
          {lvl.hasSpecializations ? (
            <>
              {/* أزرار اختيار التخصص */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                {Object.keys(lvl.tracks).map((trackName) => (
                  <button
                    key={trackName}
                    onClick={() => setActiveTrack(trackName)}
                    style={{
                      padding: "6px 12px",
                      border: "1px solid #ccc",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: activeTrack === trackName ? "#2563eb" : "#fff",
                      color: activeTrack === trackName ? "#fff" : "#333",
                    }}
                  >
                    {trackName}
                  </button>
                ))}
              </div>
              <CoursesTable courses={lvl.tracks[activeTrack]} />
            </>
          ) : (
            <CoursesTable courses={lvl.courses} />
          )}
        </div>
      )}
    </div>
  );
}

function StudyPlan() {
  const [plan, setPlan] = useState(null);
  const [openYear, setOpenYear] = useState(null);

  useEffect(() => {
    fetch("/data/study-plan.json")
      .then((res) => res.json())
      .then((data) => setPlan(data));
  }, []);

  if (!plan) return <div style={{ padding: 20 }}>جاري التحميل...</div>;

  return (
    <div style={{ flex: 1, padding: 20, fontFamily: "sans-serif", direction: "rtl" }}>
      <Link to="/">⬅ الرجوع للرئيسية</Link>
      <h1>📋 الخطة الدراسية</h1>

      {plan.years.map((y) => (
        <div key={y.year} style={{ marginBottom: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div
            onClick={() => setOpenYear(openYear === y.year ? null : y.year)}
            style={{
              padding: 14,
              background: "#f3f4f6",
              cursor: "pointer",
              fontWeight: "bold",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>السنة {y.year}</span>
            <span>{openYear === y.year ? "▲" : "▼"}</span>
          </div>

          {openYear === y.year && (
            <div style={{ padding: 10 }}>
              {y.levels.map((lvl) => (
                <LevelBlock key={lvl.level} lvl={lvl} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default StudyPlan;
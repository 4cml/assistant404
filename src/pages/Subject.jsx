import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { withBase } from "../lib/paths";

const SECTION_LABELS = {
  theory: "📖 نظري",
  lab: "🧪 عملي",
  extra: "📄 ملفات إضافية",
  exam: "❓ أسئلة",
};

// يبحث عن مقرر بالـ id داخل study-plan.json (يفحص المستويات والتخصصات)
function findCourseInPlan(plan, id) {
  for (const y of plan.years) {
    for (const lvl of y.levels) {
      if (lvl.hasSpecializations) {
        for (const trackName of Object.keys(lvl.tracks)) {
          const found = lvl.tracks[trackName].find((c) => c.id === id);
          if (found) return { ...found, year: y.year, level: lvl.level, track: trackName };
        }
      } else {
        const found = lvl.courses.find((c) => c.id === id);
        if (found) return { ...found, year: y.year, level: lvl.level };
      }
    }
  }
  return null;
}

function Subject() {
  const { id } = useParams();
  const [subject, setSubject] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [notFoundInPlan, setNotFoundInPlan] = useState(false);
  const [hasSubjectFile, setHasSubjectFile] = useState(true);

  useEffect(() => {
    // نحاول أولاً نجيب subject.json خاص بهذه المادة (لو موجود)
    fetch(withBase(`pdf/${id}/subject.json`))
      .then((res) => {
        if (!res.ok) throw new Error("no subject.json");
        return res.json();
      })
      .then((data) => {
        setSubject(data);
        setHasSubjectFile(true);
        trackVisit();
      })
      .catch(() => {
        // ما فيه subject.json خاص → نجيب المعلومات الأساسية من الخطة الدراسية
        setHasSubjectFile(false);
        fetch(withBase("data/study-plan.json"))
          .then((res) => res.json())
          .then((plan) => {
            const course = findCourseInPlan(plan, id);
            if (course) {
              setSubject({
                id: course.id,
                name: course.name,
                year: course.year,
                semester: course.level,
                creditHours: course.hours,
                department: course.track || "-",
                professors: [],
              });
              trackVisit();
            } else {
              setNotFoundInPlan(true);
            }
          });
      });

    // نحاول نجيب lectures.json (لو موجود)، وإلا نتركها فاضية
    fetch(withBase(`pdf/${id}/lectures.json`))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setLectures(data))
      .catch(() => setLectures([]));

    function trackVisit() {
      const recent = JSON.parse(localStorage.getItem("recent") || "[]");
      const updated = [id, ...recent.filter((r) => r !== id)].slice(0, 10);
      localStorage.setItem("recent", JSON.stringify(updated));

      const visits = JSON.parse(localStorage.getItem("visits") || "{}");
      visits[id] = (visits[id] || 0) + 1;
      localStorage.setItem("visits", JSON.stringify(visits));
    }
  }, [id]);

  if (notFoundInPlan) {
    return (
      <div style={{ padding: 20, direction: "rtl" }}>
        <Link to="/study-plan">⬅ الرجوع للخطة الدراسية</Link>
        <p>⚠ لم يتم العثور على هذه المادة.</p>
      </div>
    );
  }

  if (!subject) return <div style={{ padding: 20 }}>جاري التحميل...</div>;

  const grouped = lectures.reduce((acc, item) => {
    const type = item.type || "extra";
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif", direction: "rtl" }}>
      <Link to="/study-plan">⬅ الرجوع للخطة الدراسية</Link>
      <h1>{subject.name}</h1>
      <p>السنة: {subject.year}</p>
      <p>المستوى: {subject.semester}</p>
      <p>عدد الساعات: {subject.creditHours}</p>
      {subject.department && subject.department !== "-" && <p>التخصص: {subject.department}</p>}

      {!hasSubjectFile && (
        <div
          style={{
            background: "#fff8e1",
            border: "1px solid #ffe082",
            padding: 12,
            borderRadius: 6,
            marginTop: 10,
          }}
        >
          📌 لم تتم إضافة ملفات لهذه المادة بعد. المربعات تحت جاهزة، وتُملأ لاحقاً بإضافة ملفات PDF داخل مجلد المادة.
        </div>
      )}

      <hr style={{ margin: "20px 0" }} />

      {Object.keys(SECTION_LABELS).map((type) => {
        const items = grouped[type] || [];
        return (
          <div key={type} style={{ marginBottom: 24 }}>
            <h2>{SECTION_LABELS[type]}</h2>
            {items.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  border: "1px dashed #ccc",
                  borderRadius: 6,
                  color: "#999",
                  textAlign: "center",
                }}
              >
                لا يوجد محتوى بعد
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {items.map((item, i) => (
                  <li
                    key={i}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {item.title}
                      {item.week ? ` — الأسبوع ${item.week}` : ""}
                    </span>
                    {item.file ? (
                    <a href={withBase(item.file)} target="_blank" rel="noreferrer">                        فتح الملف ↗
                      </a>
                    ) : (
                      <span style={{ color: "#999" }}>لا يوجد ملف بعد</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Subject;
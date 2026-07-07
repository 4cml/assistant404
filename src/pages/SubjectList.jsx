import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

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
    fetch(`/pdf/${id}/subject.json`)
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
        fetch("/data/study-plan.json")
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
    fetch(`/pdf/${id}/lectures.json`)
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
      <div className="p-5" dir="rtl">
        <Link to="/study-plan">⬅ الرجوع للخطة الدراسية</Link>
        <p>⚠ لم يتم العثور على هذه المادة.</p>
      </div>
    );
  }

  if (!subject) return <div className="p-5">جاري التحميل...</div>;

  const grouped = lectures.reduce((acc, item) => {
    const type = item.type || "extra";
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});

  return (
    <div className="p-5 font-sans" dir="rtl">
      <Link to="/study-plan">⬅ الرجوع للخطة الدراسية</Link>
      <h1>{subject.name}</h1>
      <p>السنة: {subject.year}</p>
      <p>المستوى: {subject.semester}</p>
      <p>عدد الساعات: {subject.creditHours}</p>
      {subject.department && subject.department !== "-" && <p>التخصص: {subject.department}</p>}

      {!hasSubjectFile && (
        <div className="bg-[#fff8e1] border border-[#ffe082] p-3 rounded-md mt-2.5">
          📌 لم تتم إضافة ملفات لهذه المادة بعد. المربعات تحت جاهزة، وتُملأ لاحقاً بإضافة ملفات PDF داخل مجلد المادة.
        </div>
      )}

      <hr className="my-5" />

      {Object.keys(SECTION_LABELS).map((type) => {
        const items = grouped[type] || [];
        return (
          <div key={type} className="mb-6">
            <h2>{SECTION_LABELS[type]}</h2>
            {items.length === 0 ? (
              <div className="p-4 border border-dashed border-[#ccc] rounded-md text-[#999] text-center">
                لا يوجد محتوى بعد
              </div>
            ) : (
              <ul className="list-none p-0">
                {items.map((item, i) => (
                  <li
                    key={i}
                    className="py-2 border-b border-[#eee] flex justify-between"
                  >
                    <span>
                      {item.title}
                      {item.week ? ` — الأسبوع ${item.week}` : ""}
                    </span>
                    {item.file ? (
                      <a href={`/${item.file}`} target="_blank" rel="noreferrer">
                        فتح الملف ↗
                      </a>
                    ) : (
                      <span className="text-[#999]">لا يوجد ملف بعد</span>
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
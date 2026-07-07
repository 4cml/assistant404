import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { withBase } from "../lib/paths";

function CoursesTable({ courses }) {
  return (
    <table className="w-full border-collapse mt-2">
      <thead>
        <tr className="bg-[#f9fafb]">
          <th className="p-2 border border-[#eee]">اسم المقرر</th>
          <th className="p-2 border border-[#eee]">رمز المقرر</th>
          <th className="p-2 border border-[#eee]">الساعات</th>
        </tr>
      </thead>
      <tbody>
        {courses.map((course, i) => (
          <tr key={i}>
            <td className="p-2 border border-[#eee]">
              <Link to={`/subject/${course.subjectSlug || course.id}`} className="text-[#2563eb]">
                {course.name}
              </Link>
            </td>
            <td className="p-2 border border-[#eee]">{course.code || "-"}</td>
            <td className="p-2 border border-[#eee]">{course.hours}</td>
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
    <div className="mb-2.5">
      <div
        onClick={() => setOpen(!open)}
        className="p-2.5 bg-[#fafafa] cursor-pointer flex justify-between border border-[#eee]"
      >
        <span>{lvl.semesterLabel} — {lvl.totalHours} ساعة</span>
        <span>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div className="p-2">
          {lvl.hasSpecializations ? (
            <>
              {/* أزرار اختيار التخصص */}
              <div className="flex gap-2 mb-2.5 flex-wrap">
                {Object.keys(lvl.tracks).map((trackName) => (
                  <button
                    key={trackName}
                    onClick={() => setActiveTrack(trackName)}
                    className={`px-3 py-1.5 border border-[#ccc] rounded-md cursor-pointer ${
                      activeTrack === trackName
                        ? "bg-[#2563eb] text-white"
                        : "bg-white text-[#333]"
                    }`}
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
    fetch(withBase("data/study-plan.json"))
      .then((res) => res.json())
      .then((data) => setPlan(data));
  }, []);

  if (!plan) return <div className="p-5">جاري التحميل...</div>;

  return (
    <div className="flex-1 p-5 font-sans" dir="rtl">
      <Link to="/">⬅ الرجوع للرئيسية</Link>
      <h1>📋 الخطة الدراسية</h1>

      {plan.years.map((y) => (
        <div key={y.year} className="mb-3 border border-[#ddd] rounded-lg">
          <div
            onClick={() => setOpenYear(openYear === y.year ? null : y.year)}
            className="p-3.5 bg-[#f3f4f6] cursor-pointer font-bold flex justify-between"
          >
            <span>السنة {y.year}</span>
            <span>{openYear === y.year ? "▲" : "▼"}</span>
          </div>

          {openYear === y.year && (
            <div className="p-2.5">
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
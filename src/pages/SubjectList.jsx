import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Fuse from "fuse.js";
import { withBase } from "../lib/paths";

const MODE_TITLES = {
  all: "📚 جميع المواد",
  favorites: "⭐ المفضلة",
  recent: "🕓 آخر ما تم فتحه",
  "most-visited": "🔥 الأكثر زيارة",
};

const MODE_EMPTY_MESSAGES = {
  all: "لا توجد مواد مضافة بعد.",
  favorites: "لم تُضِف أي مادة إلى المفضلة بعد. اضغط ⭐ بجانب أي مادة لإضافتها.",
  recent: "لم تفتح أي مادة بعد.",
  "most-visited": "لا توجد بيانات زيارات كافية بعد.",
};

// يبني خريطة بحث سريعة من study-plan.json: id -> بيانات المقرر، وكذلك subjectSlug -> نفس البيانات
// (لأن بعض المواد معرّفها في الخطة الدراسية يختلف عن اسم مجلدها، مثل database <-> 1130700)
function buildPlanIndex(plan) {
  const byId = {};
  const bySlug = {};
  for (const y of plan.years) {
    for (const lvl of y.levels) {
      const pushCourse = (c, track) => {
        const meta = { ...c, year: y.year, level: lvl.level, track: track || null };
        byId[c.id] = meta;
        if (c.subjectSlug) bySlug[c.subjectSlug] = meta;
      };
      if (lvl.hasSpecializations) {
        for (const trackName of Object.keys(lvl.tracks)) {
          lvl.tracks[trackName].forEach((c) => pushCourse(c, trackName));
        }
      } else {
        lvl.courses.forEach((c) => pushCourse(c));
      }
    }
  }
  return { byId, bySlug };
}

function SubjectList({ mode = "all" }) {
  const [allIds, setAllIds] = useState([]);
  const [planIndex, setPlanIndex] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(() =>
    JSON.parse(localStorage.getItem("favorites") || "[]")
  );

  // تحميل فهرس المواد والخطة الدراسية مرة واحدة
  useEffect(() => {
    Promise.all([
      fetch(withBase("data/subjects-index.json")).then((r) => r.json()),
      fetch(withBase("data/study-plan.json")).then((r) => r.json()),
    ]).then(([ids, plan]) => {
      setAllIds(ids);
      setPlanIndex(buildPlanIndex(plan));
    });
  }, []);

  // بناء قائمة المواد المعروضة حسب mode
  useEffect(() => {
    if (!planIndex) return;

    let ids = allIds;
    if (mode === "favorites") {
      ids = allIds.filter((id) => favorites.includes(id));
    } else if (mode === "recent") {
      const recent = JSON.parse(localStorage.getItem("recent") || "[]");
      ids = recent.filter((id) => allIds.includes(id));
    } else if (mode === "most-visited") {
      const visits = JSON.parse(localStorage.getItem("visits") || "{}");
      ids = allIds
        .filter((id) => visits[id])
        .sort((a, b) => (visits[b] || 0) - (visits[a] || 0));
    }

    setLoading(true);
    Promise.all(
      ids.map((id) =>
        fetch(withBase(`pdf/${id}/subject.json`))
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) return { ...data, id };
            // ما فيه subject.json خاص لهذه المادة → نأخذ البيانات الأساسية من الخطة الدراسية
            const meta = planIndex.byId[id] || planIndex.bySlug[id];
            return {
              id,
              name: meta ? meta.name : id,
              year: meta ? meta.year : "-",
              semester: meta ? meta.level : "-",
              creditHours: meta ? meta.hours : "-",
              department: meta && meta.track ? meta.track : "-",
            };
          })
          .catch(() => ({
            id,
            name: id,
            year: "-",
            semester: "-",
            creditHours: "-",
            department: "-",
          }))
      )
    ).then((data) => {
      setSubjects(data);
      setLoading(false);
    });
  }, [allIds, planIndex, mode, favorites]);

  const fuse = useMemo(
    () =>
      new Fuse(subjects, {
        keys: ["name", "id", "department"],
        threshold: 0.4,
      }),
    [subjects]
  );

  const displayed = query.trim() ? fuse.search(query).map((r) => r.item) : subjects;

  function toggleFavorite(id) {
    const updated = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(updated);
    localStorage.setItem("favorites", JSON.stringify(updated));
  }

  return (
    <div className="p-5 font-sans w-full" dir="rtl">
      <h1 className="mb-4">{MODE_TITLES[mode] || "📚 المواد"}</h1>

      {mode === "all" && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 ابحث عن مادة أو تخصص..."
          className="w-full max-w-md mb-5 py-2 px-3 border border-[#ccc] rounded-md"
        />
      )}

      {loading ? (
        <div className="text-[#999]">جاري التحميل...</div>
      ) : displayed.length === 0 ? (
        <div className="p-4 border border-dashed border-[#ccc] rounded-md text-[#999] text-center max-w-md">
          {MODE_EMPTY_MESSAGES[mode] || "لا توجد نتائج."}
        </div>
      ) : (
        <ul className="list-none p-0 flex flex-col gap-2 max-w-2xl">
          {displayed.map((s) => (
            <li
              key={s.id}
              className="flex justify-between items-center border border-[#eee] rounded-md py-3 px-4"
            >
              <Link to={`/subject/${s.id}`} className="text-[#111] no-underline flex-1">
                <div className="font-bold">{s.name}</div>
                <div className="text-sm text-[#777]">
                  السنة {s.year} — المستوى {s.semester}
                  {s.department && s.department !== "-" ? ` — ${s.department}` : ""}
                </div>
              </Link>
              <button
                onClick={() => toggleFavorite(s.id)}
                className="border-none bg-transparent text-xl cursor-pointer"
                aria-label="إضافة للمفضلة"
              >
                {favorites.includes(s.id) ? "⭐" : "☆"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SubjectList;
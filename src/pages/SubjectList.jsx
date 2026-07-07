import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Fuse from "fuse.js";

function SubjectList({ mode }) {
  const [subjects, setSubjects] = useState([]);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    fetch("/data/subjects-index.json")
      .then((res) => res.json())
      .then(async (ids) => {
        const data = await Promise.all(
          ids.map((id) =>
            fetch(`/pdf/${id}/subject.json`).then((res) => res.json())
          )
        );
        setSubjects(data);
      });

    const saved = JSON.parse(localStorage.getItem("favorites") || "[]");
    setFavorites(saved);
  }, []);

  const toggleFavorite = (id) => {
    let updated;
    if (favorites.includes(id)) {
      updated = favorites.filter((f) => f !== id);
    } else {
      updated = [...favorites, id];
    }
    setFavorites(updated);
    localStorage.setItem("favorites", JSON.stringify(updated));
  };

  // نطبق الفلتر حسب mode
  let filtered = subjects;
  let title = "📚 جميع المواد";

  if (mode === "favorites") {
    filtered = subjects.filter((s) => favorites.includes(s.id));
    title = "⭐ المفضلة";
  } else if (mode === "recent") {
    const recentIds = JSON.parse(localStorage.getItem("recent") || "[]");
    filtered = recentIds
      .map((id) => subjects.find((s) => s.id === id))
      .filter(Boolean);
    title = "🕓 آخر ما تم فتحه";
  } else if (mode === "most-visited") {
    const visits = JSON.parse(localStorage.getItem("visits") || "{}");
    filtered = [...subjects]
      .filter((s) => visits[s.id] > 0)
      .sort((a, b) => (visits[b.id] || 0) - (visits[a.id] || 0));
    title = "🔥 الأكثر زيارة";
  }

  // البحث يطبق فوق النتيجة المفلترة
  const fuse = new Fuse(filtered, {
    keys: ["name", "id", "professors", "department"],
    threshold: 0.4,
  });
  const results = query.trim() === "" ? filtered : fuse.search(query).map((r) => r.item);

  return (
    <div className="flex-1 p-5 font-sans" dir="rtl">
      <h1>{title}</h1>

      <input
        type="text"
        placeholder="🔍 ابحث عن مادة، دكتور، قسم..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        dir="rtl"
        className="w-full p-2.5 text-base mb-5"
      />

      {results.length === 0 && <p>لا توجد نتائج.</p>}

      <div>
        {results.map((subject) => (
          <div
            key={subject.id}
            className="flex justify-between items-center p-2.5 border-b border-[#ddd]"
          >
            <Link to={`/subject/${subject.id}`} className="no-underline text-inherit">
              <strong>{subject.name}</strong> — السنة {subject.year}، الفصل {subject.semester}
            </Link>
            <button
              onClick={() => toggleFavorite(subject.id)}
              className="border-none bg-transparent text-xl cursor-pointer"
            >
              {favorites.includes(subject.id) ? "⭐" : "☆"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SubjectList;
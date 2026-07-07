import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Fuse from "fuse.js";

function Home() {
  const [subjects, setSubjects] = useState([]);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    // نجيب قائمة المواد
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

    // نجيب المفضلة من Local Storage
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

  const fuse = new Fuse(subjects, {
    keys: ["name", "id", "professors", "department"],
    threshold: 0.4,
  });

  const results = query.trim() === "" ? subjects : fuse.search(query).map((r) => r.item);

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif", direction: "rtl" }}>
      <h1>📚 الأرشيف الأكاديمي</h1>

      <input
        type="text"
        placeholder="🔍 ابحث عن مادة، دكتور، قسم..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          fontSize: 16,
          marginBottom: 20,
          direction: "rtl",
        }}
      />

      {results.length === 0 && <p>لا توجد نتائج.</p>}

      <div>
        {results.map((subject) => (
          <div
            key={subject.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 10,
              borderBottom: "1px solid #ddd",
            }}
          >
            <Link to={`/subject/${subject.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <strong>{subject.name}</strong> — السنة {subject.year}، الفصل {subject.semester}
            </Link>
            <button onClick={() => toggleFavorite(subject.id)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}>
              {favorites.includes(subject.id) ? "⭐" : "☆"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;
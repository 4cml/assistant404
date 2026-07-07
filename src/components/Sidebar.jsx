import { Link, useLocation } from "react-router-dom";

function Sidebar() {
  const location = useLocation();

  const links = [
    { path: "/", label: "🏠 الرئيسية" },
    { path: "/all", label: "📚 جميع المواد" },
    { path: "/favorites", label: "⭐ المفضلة" },
    { path: "/recent", label: "🕓 آخر ما تم فتحه" },
    { path: "/most-visited", label: "🔥 الأكثر زيارة" },
    { path: "/study-plan", label: "📋 الخطة الدراسية" },
  ];

  return (
    <div
      style={{
        width: 200,
        minHeight: "100vh",
        borderLeft: "1px solid #ddd",
        padding: 20,
        fontFamily: "sans-serif",
        direction: "rtl",
      }}
    >
      <h3 style={{ marginBottom: 20 }}>القائمة</h3>
      {links.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          style={{
            display: "block",
            padding: "10px 0",
            textDecoration: "none",
            color: location.pathname === link.path ? "#2563eb" : "#333",
            fontWeight: location.pathname === link.path ? "bold" : "normal",
          }}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export default Sidebar;
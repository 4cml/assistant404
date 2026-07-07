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
      dir="rtl"
      className="w-[200px] min-h-screen border-l border-solid border-[#ddd] p-5 font-sans"
    >
      <h3 className="mb-5">القائمة</h3>
      {links.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className={`block py-2.5 px-0 no-underline ${
            location.pathname === link.path
              ? "text-[#2563eb] font-bold"
              : "text-[#333] font-normal"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export default Sidebar;
import { useState } from "react";
import { setGithubToken, hasGithubToken, clearGithubToken } from "../../lib/githubSync";
import "./AdminHome.css";

/**
 * AdminTokenGate.jsx
 * -----------------------------------------------------------------------
 * يُلَفّ حول محتوى أي شاشة إدارية. لو ما فيه توكن بالذاكرة، يعرض نموذج
 * إدخال ويوقف عرض المحتوى. بمجرد الإدخال، يُخزَّن التوكن بذاكرة الموديول
 * (githubSync.js) — وليس أي تخزين متصفح دائم — ويستمر متاحاً بين شاشات
 * اللوحة المختلفة بدون إعادة إدخال، لحد ما تحدّث الصفحة أو تسكّر التبويب.
 *
 * تقدر أيضاً تتخطى إدخال التوكن (زر "تخطي") لو تبي تستخدم آلية "تنزيل
 * JSON يدوي" القديمة بدل الربط الحي — التوكن اختياري وليس شرطاً.
 * -----------------------------------------------------------------------
 */

export default function AdminTokenGate({ children }) {
  const [unlocked, setUnlocked] = useState(hasGithubToken());
  const [skipped, setSkipped] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError("لازم تدخل توكن صالح، أو تضغط تخطي لاستخدام التنزيل اليدوي.");
      return;
    }
    setGithubToken(tokenInput.trim());
    setUnlocked(true);
  }

  function handleSkip() {
    clearGithubToken();
    setSkipped(true);
  }

  function handleLogout() {
    clearGithubToken();
    setUnlocked(false);
    setSkipped(false);
    setTokenInput("");
  }

  if (unlocked || skipped) {
    return (
      <>
        {unlocked && (
          <div
            className="admin-empty"
            style={{
              textAlign: "right",
              padding: "8px 16px",
              background: "rgba(37,99,235,0.08)",
              color: "#2563eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span>🔑 متصل بـ GitHub — التغييرات تُنشر مباشرة على main</span>
            <button className="btn btn--sm" onClick={handleLogout}>
              مسح التوكن
            </button>
          </div>
        )}
        {skipped && !unlocked && (
          <div
            className="admin-empty"
            style={{
              textAlign: "right",
              padding: "8px 16px",
              background: "rgba(107,114,128,0.1)",
              color: "#6b7280",
              marginBottom: 12,
            }}
          >
            وضع التنزيل اليدوي (بدون توكن) —{" "}
            <button
              className="btn btn--sm"
              onClick={() => setSkipped(false)}
              style={{ marginRight: 4 }}
            >
              إدخال توكن الآن
            </button>
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <div className="admin-home">
      <div
        className="admin-subject-row"
        style={{ flexDirection: "column", alignItems: "stretch", gap: 12, maxWidth: 480, margin: "40px auto" }}
      >
        <h2 style={{ margin: 0 }}>🔑 توكن GitHub للنشر المباشر</h2>

        <p className="admin-home__hint">
          هذا التوكن <strong>لا يُحفظ إطلاقاً</strong> — لا بالمتصفح ولا بأي
          تخزين دائم. يبقى بالذاكرة فقط طول ما التبويب مفتوح، وينمسح تلقائياً
          عند تحديث الصفحة أو إغلاقها. يُستخدم فقط للاتصال المباشر بـ
          GitHub API لعمل commit بالريبو.
        </p>

        <p className="admin-home__hint">
          ⚠️ لا يوجد نظام صلاحيات حقيقي هنا — أي شخص يملك توكن صالح على هذا
          الريبو يقدر يعدّل الموقع مباشرة على main، بدون خطوة مراجعة.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            GitHub Personal Access Token (Fine-grained، صلاحية Contents:
            Read and write فقط على 4cml/assistant404)
            <input
              type="password"
              className="btn"
              style={{ width: "100%", marginTop: 4 }}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="github_pat_..."
              autoComplete="off"
            />
          </label>

          {error && <div className="admin-state admin-state--error">{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn--primary">
              دخول
            </button>
            <button type="button" className="btn" onClick={handleSkip}>
              تخطي (استخدام التنزيل اليدوي بدل النشر المباشر)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
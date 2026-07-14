/**
 * githubSync.js
 * -----------------------------------------------------------------------
 * الربط الحي بين لوحة التحكم وريبو GitHub عبر Contents API.
 *
 * ⚠️ التوكن يُخزَّن هنا بمتغيّر JS بالذاكرة فقط (module-level variable) —
 * لا localStorage ولا sessionStorage إطلاقاً. يُمسح تلقائياً عند تحديث
 * الصفحة أو إغلاق التبويب لأن الموديول نفسه يُعاد تحميله بهذي الحالة.
 * -----------------------------------------------------------------------
 */

const REPO_OWNER = "4cml";
const REPO_NAME = "assistant404";
const BRANCH = "main";
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

// ------------------------------------------------------------------
// إدارة التوكن — بالذاكرة فقط
// ------------------------------------------------------------------

let _token = null;

export function setGithubToken(token) {
  _token = token || null;
}

export function getGithubToken() {
  return _token;
}

export function clearGithubToken() {
  _token = null;
}

export function hasGithubToken() {
  return Boolean(_token);
}

// ------------------------------------------------------------------
// ترميز/فك ترميز base64 آمن لنص UTF-8 (يدعم العربي بشكل صحيح،
// عكس btoa/atob المباشر اللي ينكسر مع أي حرف خارج Latin1)
// ------------------------------------------------------------------

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ------------------------------------------------------------------
// عمليات GitHub API
// ------------------------------------------------------------------

/**
 * يجيب محتوى ملف من الريبو + sha الحالي.
 * لو الملف غير موجود أصلاً (ملف جديد)، يرجّع { content: null, sha: null }
 * بدل ما يرمي خطأ — يسمح بإنشاء ملفات جديدة عبر نفس المسار.
 */
export async function fetchFileFromGitHub(path, token) {
  const res = await fetch(`${API_BASE}/contents/${path}?ref=${BRANCH}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (res.status === 404) {
    return { content: null, sha: null };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`فشل جلب ${path} من GitHub (${res.status}): ${body}`);
  }

  const data = await res.json();
  return { content: base64ToUtf8(data.content), sha: data.sha };
}

/**
 * يرسل commit لتحديث/إنشاء ملف بالريبو.
 * @param {string} path مسار الملف داخل الريبو
 * @param {string} newContent المحتوى الجديد (نص خام، JSON.stringify مسبقاً)
 * @param {string|null} sha الـ sha الحالي (null لو ملف جديد)
 * @param {string} token
 * @param {string} commitMessage
 */
export async function commitFileToGitHub(path, newContent, sha, token, commitMessage) {
  const body = {
    message: commitMessage,
    content: utf8ToBase64(newContent),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    throw new Error(
      `تعارض بالحفظ لملف "${path}": شخص آخر عدّله بنفس اللحظة. أعد تحميل اللوحة وحاول مرة ثانية.`
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("التوكن غير صالح أو ما يملك صلاحية الكتابة على هذا الريبو.");
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`فشل حفظ ${path} بـ GitHub (${res.status}): ${errBody}`);
  }

  return res.json();
}

// ------------------------------------------------------------------
// تحقق أساسي قبل أي commit — يمنع إفساد بيانات حية على الطلاب
// ------------------------------------------------------------------

/**
 * @param {string} content نص JSON خام قبل الإرسال
 * @param {"study-plan"|"lectures"} schemaType
 * @returns {{valid: boolean, error?: string}}
 */
export function validateJsonBeforeCommit(content, schemaType) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return { valid: false, error: `المحتوى ليس JSON صالح: ${err.message}` };
  }

  if (schemaType === "study-plan") {
    if (!parsed || !Array.isArray(parsed.years)) {
      return { valid: false, error: "study-plan.json يجب أن يحتوي مصفوفة years" };
    }
    for (const y of parsed.years) {
      if (!Array.isArray(y.levels)) {
        return { valid: false, error: `السنة ${y.year} بدون مصفوفة levels صالحة` };
      }
    }
    return { valid: true };
  }

  if (schemaType === "lectures") {
    if (!Array.isArray(parsed)) {
      return { valid: false, error: "lectures.json يجب أن يكون مصفوفة" };
    }
    for (const [i, lec] of parsed.entries()) {
      if (!lec.type || !lec.title || !lec.file) {
        return {
          valid: false,
          error: `المحاضرة رقم ${i + 1} ناقصة حقل (type/title/file)`,
        };
      }
    }
    return { valid: true };
  }

  return { valid: false, error: `نوع schema غير معروف: ${schemaType}` };
}
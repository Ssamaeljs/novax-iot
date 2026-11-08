const AppError = require("../handleError/AppError");
const COOKIE_NAME = "novax_session";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/v1/api",
  };
}
function readSessionCookie(req) {
  const value = (req.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!value) return null;
  try {
    return decodeURIComponent(value.slice(COOKIE_NAME.length + 1));
  } catch {
    return null;
  }
}
function assertWebRequest(req) {
  // A non-simple header forces a CORS preflight. SameSite is defense in depth.
  if (req.get("x-novax-csrf") !== "1")
    throw new AppError("Solicitud web no válida", 403, "CSRF_REJECTED");
  const origins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim());
  if (process.env.WEB_ORIGIN)
    origins.push(new URL(process.env.WEB_ORIGIN).origin);
  if (process.env.NODE_ENV !== "production")
    origins.push("http://localhost:4200", "http://127.0.0.1:4200");
  if (!origins.includes(req.get("origin")))
    throw new AppError("Origen no autorizado", 403, "CSRF_REJECTED");
}
function setSessionCookie(res, session) {
  res.cookie(COOKIE_NAME, session.token, {
    ...cookieOptions(),
    expires: new Date(session.expires_at),
  });
}
function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}
module.exports = {
  COOKIE_NAME,
  cookieOptions,
  readSessionCookie,
  assertWebRequest,
  setSessionCookie,
  clearSessionCookie,
};

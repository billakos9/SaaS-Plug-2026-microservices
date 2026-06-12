import http, {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "./http";

/**
 * Decodes a JWT payload without an external library.
 */
const decodeJwtPayload = (token) => {
  if (!token) return null;

  const parts = String(token).split(".");
  if (parts.length < 2) return null;

  try {
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = payload.length % 4;
    if (padding) payload += "=".repeat(4 - padding);

    const decodeBase64 =
      typeof atob === "function"
        ? atob
        : (value) => Buffer.from(value, "base64").toString("utf-8");

    const decoded = JSON.parse(decodeBase64(payload));
    console.log("[Auth] Decoded token payload:", decoded);
    return decoded;
  } catch (err) {
    console.error("[Auth] Failed to decode JWT:", err);
    return null;
  }
};

/**
 * Builds a local user object from a JWT token.
 * New JWT structure: { userId, role, email, username }
 */
const buildUserFromToken = (token) => {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const role = payload.role || "user";

  const user = {
    id: payload.userId || payload.adminId || payload.sub,
    email: payload.email || "",
    username: payload.username || "",
    name: payload.name || (payload.email ? payload.email.split("@")[0] : "saasPlug User"),
    role: role,
    isAdmin: role === "admin",
    isProvider: role === "provider",
    providerName: payload.providerName || null,
  };
  console.log("[Auth] Built user from token:", user);
  return user;
};

/**
 * Normalizes user profile data from the user-service.
 */
const normalizeUserProfile = (data) => {
  if (!data) return null;

  const role = data.role || "user";

  return ({
    id: data.userId || data.id,
    email: data.email || "",
    username: data.username || "",
    name: data.name || (data.email ? data.email.split("@")[0] : "saasPlug User"),
    phoneNumber: data.phoneNumber || null,
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    birthdate: data.birthdate || null,
    role: role,
    isAdmin: role === "admin",
    isProvider: role === "provider",
  });
};

export const getAuthToken = () => getStoredToken();
export const setAuthToken = (token) => setStoredToken(token);
export const clearAuthToken = () => clearStoredToken();
export const getUserFromToken = () => buildUserFromToken(getStoredToken());

/**
 * Fetches current user profile from user-service.
 * Backend route: GET /user/me (mapped via gateway to /api/users/me)
 */
export async function getCurrentUser() {
  try {
    const res = await http.get("/users/me");
    console.log("[Auth] Fetched user profile:", res.data);
    return normalizeUserProfile(res.data);
  } catch (err) {
    console.error("[Auth] Failed to fetch current user profile:", err.message);
    throw err;
  }
}

/**
 * Login flow.
 * Backend route: POST /auth/login (mapped via gateway to /api/auth/login)
 */
export async function login(email, password) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  console.log("[Auth] Attempting login for:", email);

  let token = null;

  // Try user auth-service first, then fall back to admin-service
  try {
    const res = await http.post("/auth/login", { email, password });
    token = res.data?.accessToken || res.data?.token;
  } catch {
    // auth-service rejected — try admin-service
  }

  if (!token) {
    try {
      const res = await http.post("/admin/login", { email, password });
      token = res.data?.accessToken || res.data?.token;
    } catch {
      // admin-service also rejected
    }
  }

  if (!token) {
    throw new Error("Invalid credentials");
  }

  console.log("[Auth] Login successful, saving token.");
  setStoredToken(token);

  const tokenUser = buildUserFromToken(token);

  // Admins don't have a user-service profile — fall back to token data
  try {
    const profile = await getCurrentUser();
    const finalUser = {
      ...profile,
      role: profile.role || tokenUser?.role,
      isAdmin: profile.isAdmin || tokenUser?.isAdmin,
      isProvider: profile.isProvider || tokenUser?.isProvider,
    };
    console.log("[Auth] Final user state established:", finalUser);
    return finalUser;
  } catch (err) {
    console.warn("[Auth] Could not fetch user profile after login, using token data.", err.message);
    return tokenUser;
  }
}

/**
 * Registration flow.
 */
export async function register({ email, password, name, phoneNumber, username, firstName, lastName, birthdate, role }) {
  if (!email || !password || !name) {
    throw new Error("Email, password and name are required");
  }

  const res = await http.post("/auth/register", { 
    email, 
    password, 
    name,
    phoneNumber,
    username,
    firstName,
    lastName,
    birthdate,
    role: role || "user"
  });
  
  return normalizeUserProfile(res.data) || res.data;
}

/**
 * Updates the current user profile.
 */
export async function updateProfile(updateData) {
  console.log("[Auth] Updating profile with:", updateData);
  const res = await http.put("/users/me", updateData);
  return normalizeUserProfile(res.data);
}

export function logout() {
  console.log("[Auth] Logging out, clearing token.");
  clearStoredToken();
}

import http, {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "./http";

// header.payload.signature
const decodeJwtPayload = (token) => {
  if (!token) return null;

  // split tokens on "."
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

    return JSON.parse(decodeBase64(payload));
  } catch {
    return null;
  }
};


const buildUserFromToken = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const email = payload.email || payload.userEmail || "";
  const username =
    payload.username ||
    payload.userName ||
    payload.name ||
    (email ? email.split("@")[0] : undefined);

  return ({
    id: payload.userId || payload.id || payload.sub,
    email,
    username,
    name: username || (email ? email.split("@")[0] : "IonOS User"),
    role: payload.role,
    isAdmin: payload.role === "admin",
  });
};

const normalizeUserProfile = (data) => {
  if (!data) return null;

  const email = data.userEmail ?? data.email ?? "";
  const username =
    data.username ||
    data.userName ||
    data.name ||
    (email ? email.split("@")[0] : undefined);

  return ({
    id: data.userInfoId ?? data.userId ?? data.id,
    userInfoId: data.userInfoId ?? data.userId ?? data.id,
    email,
    username,
    name: username,
    phoneNumber: data.userPhoneNumber ?? data.phoneNumber ?? null,
    firstName: data.userFirstName ?? data.firstName ?? null,
    lastName: data.userLastName ?? data.lastName ?? null,
    birthdate: data.userBirthdate ?? data.birthdate ?? null,
    profilePhoto: data.userProfilePhoto ?? data.profilePhoto ?? null,
    role: data.role,
    isAdmin: data.role === "admin",
  });
};

export const getAuthToken = () => getStoredToken();
export const setAuthToken = (token) => setStoredToken(token);
export const clearAuthToken = () => clearStoredToken();
export const getUserFromToken = () => buildUserFromToken(getStoredToken());

export async function getCurrentUser() {
  const res = await http.get("/users/me");
  return normalizeUserProfile(res.data);
}

export async function login(email, password) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const res = await http.post("/auth/login", { email, password });
  const token = res.data?.token;

  if (!token) {
    throw new Error("Login failed: no token returned");
  }

  setStoredToken(token);

  const tokenUser = buildUserFromToken(token);
  const profile = await getCurrentUser().catch(() => null);

  if (profile) {
    return {
      ...profile,
      role: profile.role || tokenUser?.role,
      isAdmin: (profile.role || tokenUser?.role) === "admin",
    };
  }

  return {
    id: tokenUser?.id || "auth-user",
    username: tokenUser?.username,
    name: tokenUser?.name || email.split("@")[0] || "IonOS User",
    email: tokenUser?.email || email,
    role: tokenUser?.role,
    isAdmin: tokenUser?.role === "admin",
  };
}

export async function register({ email, password, name }) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const res = await http.post("/auth/register", { email, password, name });
  return normalizeUserProfile(res.data) || res.data;
}

export function logout() {
  clearStoredToken();
}

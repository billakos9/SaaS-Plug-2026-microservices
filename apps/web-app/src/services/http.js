import axios from "axios";

// jwt token
export const AUTH_TOKEN_KEY = "ionos:auth:token";

let cachedAuthToken = null;

// can be imported from other files
// reads the jwt token, is this user logged in?
export const getStoredToken = () => {
  // if cached token great, error handling if not browser environment 
  if (cachedAuthToken) return cachedAuthToken;
  if (typeof window === "undefined") return null;

  // if find token in local storage => store it in cache
  const stored = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (stored) cachedAuthToken = stored;
  return stored;
};

// stores the jwt token
// login or logout calls this function
export const setStoredToken = (token) => {
  cachedAuthToken = token || null;
  if (typeof window === "undefined") return;

  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } 
  // logout = remove token
  else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
};

// shortcut for logout from the function before
export const clearStoredToken = () => setStoredToken(null);

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "/api";

// request max time for response = 10 sec
export const http = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// friendly messages based on status codes
const HTTP_STATUS_MESSAGES = {
  400: "Your request looks invalid. Please check the fields and try again.",
  401: "Your session has expired. Please log in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "This action conflicts with existing data.",
  422: "Some fields are invalid. Please review and try again.",
  429: "Too many requests. Please wait a moment and try again.",
};

const GENERIC_HTTP_ERROR_MESSAGE =
  "We could not complete your request. Please try again shortly.";
const NETWORK_ERROR_MESSAGE =
  "We could not connect right now. Please check your connection and try again.";
const TIMEOUT_ERROR_MESSAGE = "The request timed out. Please try again.";

// get error from backend
const normalizeBackendError = (value) => {
  // to string and remove spaces
  const message = String(value ?? "").trim();
  if (!message) return null;
  if (/request failed with status code \d+/i.test(message)) return null;

  // dont show to user these messages
  const genericBackendMessages = new Set([
    "bad request",
    "unauthorized",
    "forbidden",
    "not found",
    "conflict",
    "unprocessable entity",
    "too many requests",
    "internal server error",
  ]);

  if (genericBackendMessages.has(message.toLowerCase())) return null;
  return message;
};


const getFriendlyStatusMessage = (status) => {
  if (!status) return GENERIC_HTTP_ERROR_MESSAGE;
  if (HTTP_STATUS_MESSAGES[status]) return HTTP_STATUS_MESSAGES[status];
  if (status >= 500) return GENERIC_HTTP_ERROR_MESSAGE;
  return "The request could not be completed. Please try again.";
};

// axios errors to friendly errors
const createFriendlyApiError = (error) => {
  if (!axios.isAxiosError(error)) {
    const fallback = new Error(error?.message || GENERIC_HTTP_ERROR_MESSAGE);
    fallback.cause = error;
    return fallback;
  }

  let message = GENERIC_HTTP_ERROR_MESSAGE;
  let status = null;

  if (error.code === "ECONNABORTED") {
    message = TIMEOUT_ERROR_MESSAGE;
  // no response => backend not connected
  } else if (!error.response) {
    message = NETWORK_ERROR_MESSAGE;
  } else {
    status = error.response.status;
    const backendMessage = normalizeBackendError(error.response.data?.error ??
        error.response.data?.message ??
        error.response.data?.detail
    );

    message = backendMessage || getFriendlyStatusMessage(status);
  }

  const friendlyError = new Error(message);
  friendlyError.cause = error;
  if (status) friendlyError.status = status;
  return friendlyError;
};


http.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);


http.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(createFriendlyApiError(error))
);

export default http;

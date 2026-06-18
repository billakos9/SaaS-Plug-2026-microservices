import { PROVIDER_SERVICE_URL, USER_SERVICE_URL, CHARGER_SERVICE_URL, AUTH_SERVICE_URL } from "../config/env.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

// ── N12 Circuit-breaker state ─────────────────────────────────────────────────
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 30_000;
const CIRCUIT_OPEN_MS   = 60_000;
const circuits = new Map();

function getCircuit(url) {
  const host = new URL(url).hostname;
  if (!circuits.has(host)) circuits.set(host, { failures: [], openUntil: 0 });
  return circuits.get(host);
}
function circuitIsOpen(c) { return c.openUntil > Date.now(); }
function recordFailure(c) {
  const now = Date.now();
  c.failures = c.failures.filter(t => now - t < CIRCUIT_WINDOW_MS);
  c.failures.push(now);
  if (c.failures.length >= CIRCUIT_THRESHOLD) c.openUntil = now + CIRCUIT_OPEN_MS;
}
function recordSuccess(c) { c.failures = []; c.openUntil = 0; }

// ── N11 timeout · N12 circuit breaker · N13 retry ────────────────────────────
const PROXY_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;

/**
 * Proxies a request to a downstream service and returns the parsed JSON response.
 * Includes a 5 s timeout (N11), per-host circuit breaker (N12), and
 * exponential-backoff retry for idempotent methods (N13).
 * Throws AppError if the downstream service returns an error status.
 * @param {String} url - The URL to proxy the request to.
 * @param {String} method - The HTTP method to use (default: "GET").
 * @param {Object|null} body - The request body to send (for POST/PUT requests).
 * @param {String|null} token - Optional Authorization header value.
 * @returns {Promise<Object>} The parsed JSON response from the downstream service.
 * @throws {AppError} If the downstream service returns a non-OK status or if there is a network error.
 */
async function proxyRequest(url, method = "GET", body = null, token = null) {
  const circuit = getCircuit(url);
  if (circuitIsOpen(circuit)) {
    throw new AppError(HttpCode.SERVICE_UNAVAILABLE, "Service temporarily unavailable — please try again shortly.");
  }

  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (token) options.headers["Authorization"] = token;
  if (body) options.body = JSON.stringify(body);

  // Only idempotent reads are safe to retry; DELETE is excluded because a
  // successful upstream delete followed by a dropped connection would retry and
  // receive a 404, falsely signalling failure to the admin operator.
  const isSafe = method === "GET";
  const attempts = isSafe ? MAX_RETRIES + 1 : 1;

  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 200 * 2 ** (i - 1)));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      continue; // network error or timeout — retry if safe
    }
    clearTimeout(timer);

    // 4xx: caller error — do not retry, do not count as circuit failure
    if (!res.ok && res.status < 500) {
      const data = await res.json().catch(() => ({}));
      throw new AppError(res.status, data?.error ?? "Downstream service error", data?.debugInfo ?? null);
    }

    // 5xx: upstream failure — retry if safe, track for circuit
    if (!res.ok) {
      lastErr = new Error(`Upstream ${url} returned ${res.status}`);
      recordFailure(circuit);
      if (i < attempts - 1) continue;
      const data = await res.json().catch(() => ({}));
      throw new AppError(res.status, data?.error ?? "Downstream service error", data?.debugInfo ?? null);
    }

    recordSuccess(circuit);
    return res.json();
  }

  recordFailure(circuit);
  throw new AppError(HttpCode.SERVER_ERROR, `Downstream service unreachable: ${url}`, lastErr?.message);
}

/**
 * ManagementService provides methods to manage providers, users, and chargers by proxying requests to the respective downstream services. It includes methods for retrieving all records, retrieving by ID, creating/updating records, and deleting records. Each method uses the proxyRequest helper to handle communication with the downstream services and throws AppError instances for consistent error handling across the application.
 * Methods:
 * - getAllProviders(): Retrieves a list of all providers.
 * - getProviderById(id): Retrieves a provider by their unique ID.
 * - registerProvider(body): Registers a new provider with the given data.
 * - updateProvider(id, body): Updates an existing provider's data by their ID.
 * - deleteProvider(id): Deletes a provider by their ID.
 * - getAllUsers(): Retrieves a list of all users.
 * - getUserById(id): Retrieves a user by their unique ID.
 * - deleteUser(id): Deletes a user by their ID.
 * - getAllChargers(): Retrieves a list of all chargers.
 * - getChargerById(id): Retrieves a charger by its unique ID.
 * - getChargersByStatus(status): Retrieves chargers filtered by their status.
 *
 * All methods throw AppError with appropriate HTTP status codes and messages for error scenarios, such as invalid input, downstream service errors, or network issues.
 */
class ManagementService {
  // ── Providers ────────────────────────────────────────────────────────────────

  /**
   * Retrieves a list of all providers.
   * @returns {Promise<Array>} A promise resolving to an array of provider objects.
   * @throws {AppError} If there is an error communicating with the provider service, an AppError with status SERVER_ERROR is thrown.
   */
  static getAllProviders(token) {
    return proxyRequest(`${PROVIDER_SERVICE_URL}/provider/`, "GET", null, token);
  }

  /**
   * Retrieves a provider by their unique ID.
   * @param {Number} id - The unique identifier of the provider to retrieve.
   * @returns {Promise<Object>} A promise resolving to the provider object.
   * @throws {AppError} If there is an error communicating with the provider service, an AppError with status SERVER_ERROR is thrown.
   */
  static getProviderById(id, token) {
    return proxyRequest(`${PROVIDER_SERVICE_URL}/provider/${id}`, "GET", null, token);
  }

  /**
   * Registers a new provider with the given data.
   * @param {Object} body - The data for the new provider.
   * @returns {Promise<Object>} A promise resolving to the registered provider object.
   * @throws {AppError} If there is an error communicating with the provider service, an AppError with status SERVER_ERROR is thrown.
   */
  static async registerProvider(body, token) {
    // auth-service creates the credential and publishes provider.registered event;
    // provider-service creates its record autonomously via RabbitMQ consumer
    return proxyRequest(`${AUTH_SERVICE_URL}/auth/internal/provider`, "POST", {
      email: body.email,
      password: body.password,
      providerName: body.providerName,
      apiBaseUrl: body.apiBaseUrl,
      apiKey: body.apiKey,
    }, token);
  }

  /**
   * Updates an existing provider's data by their ID.
   * @param {Number} id - The unique identifier of the provider to update.
   * @param {Object} body - The updated data for the provider.
   * @returns {Promise<Object>} A promise resolving to the updated provider object.
   * @throws {AppError} If there is an error communicating with the provider service, an AppError with status SERVER_ERROR is thrown.
   */
  static updateProvider(id, body, token) {
    return proxyRequest(`${PROVIDER_SERVICE_URL}/provider/update/${id}`, "PUT", body, token);
  }

  /**
   * Deletes a provider by their ID.
   * @param {Number} id - The unique identifier of the provider to delete.
   * @returns {Promise<Object>} A promise resolving to the deleted provider object.
   * @throws {AppError} If there is an error communicating with the provider service, an AppError with status SERVER_ERROR is thrown.
   */
  static deleteProvider(id, token) {
    return proxyRequest(`${PROVIDER_SERVICE_URL}/provider/delete/${id}`, "DELETE", null, token);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  /**
   * Retrieves a list of all users.
   * @returns {Promise<Array>} A promise resolving to an array of user objects.
   * @throws {AppError} If there is an error communicating with the user service, an AppError with status SERVER_ERROR is thrown.
   */
  static getAllUsers(token) {
    return proxyRequest(`${USER_SERVICE_URL}/user/`, "GET", null, token);
  }

  /**
   * Retrieves a user by their unique ID.
   * @param {Number} id - The unique identifier of the user to retrieve.
   * @returns {Promise<Object>} A promise resolving to the user object.
   * @throws {AppError} If there is an error communicating with the user service, an AppError with status SERVER_ERROR is thrown.
   */
  static getUserById(id, token) {
    return proxyRequest(`${USER_SERVICE_URL}/user/${id}`, "GET", null, token);
  }

  /**
   * Deletes a user by their unique ID.
   * @param {Number} id - The unique identifier of the user to delete.
   * @returns {Promise<Object>} A promise resolving to the deleted user object.
   * @throws {AppError} If there is an error communicating with the user service, an AppError with status SERVER_ERROR is thrown.
   */
  static deleteUser(id, token) {
    return proxyRequest(`${USER_SERVICE_URL}/user/delete/${id}`, "DELETE", null, token);
  }

  // ── Chargers ──────────────────────────────────────────────────────────────
  /**
   * Retrieves a list of all chargers.
   * @returns {Promise<Array>} A promise resolving to an array of charger objects.
   * @throws {AppError} If there is an error communicating with the charger service, an AppError with status SERVER_ERROR is thrown.
   */
  static getAllChargers() {
    return proxyRequest(`${CHARGER_SERVICE_URL}/charger`);
  }
  /**
   * Retrieves a charger by their unique ID.
   * @param {Number} id - The unique identifier of the charger to retrieve.
   * @returns {Promise<Object>} A promise resolving to the charger object.
   * @throws {AppError} If there is an error communicating with the charger service, an AppError with status SERVER_ERROR is thrown.
   */
  static getChargerById(id) {
    return proxyRequest(`${CHARGER_SERVICE_URL}/charger/id/${id}`);
  }

  /**
   * Retrieves chargers by their status.
   * @param {String} status - The status of the chargers to retrieve.
   * @returns {Promise<Array>} A promise resolving to an array of charger objects.
   * @throws {AppError} If there is an error communicating with the charger service, an AppError with status SERVER_ERROR is thrown.
   */
  static getChargersByStatus(status) {
    return proxyRequest(`${CHARGER_SERVICE_URL}/charger/status/${status}`);
  }
}

export default ManagementService;

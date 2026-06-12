import { PROVIDER_SERVICE_URL, USER_SERVICE_URL, CHARGER_SERVICE_URL } from "../config/env.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

/**
 * Proxies a request to a downstream service and returns the parsed JSON response.
 * Throws AppError if the downstream service returns an error status.
 * @param {String} url - The URL to proxy the request to.
 * @param {String} method - The HTTP method to use (default: "GET").
 * @param {Object|null} body - The request body to send (for POST/PUT requests).
 * @returns {Promise<Object>} The parsed JSON response from the downstream service.
 * @throws {AppError} If the downstream service returns a non-OK status or if there is a network error.
 */
async function proxyRequest(url, method = "GET", body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (body) options.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    console.error(`[proxy] failed to reach ${url}:`, err.message);
    throw new AppError(HttpCode.SERVER_ERROR, `Downstream service unreachable: ${url}`, err.message);
  }

  const data = await res.json();

  if (!res.ok) {
    console.error(`[proxy] ${url} error:`, data);
    throw new AppError(res.status, data?.error ?? "Downstream service error", data?.debugInfo ?? null);
  }

  return data;
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
  static getAllProviders() {
    return proxyRequest(`${PROVIDER_SERVICE_URL}/provider/`);
  }

  /**
   * Retrieves a provider by their unique ID.
   * @param {Number} id - The unique identifier of the provider to retrieve.
   * @returns {Promise<Object>} A promise resolving to the provider object.
   * @throws {AppError} If there is an error communicating with the provider service, an AppError with status SERVER_ERROR is thrown.
   */
  static getProviderById(id) {
    return proxyRequest(`${PROVIDER_SERVICE_URL}/provider/${id}`);
  }

  /**
   * Registers a new provider with the given data.
   * @param {Object} body - The data for the new provider.
   * @returns {Promise<Object>} A promise resolving to the registered provider object.
   * @throws {AppError} If there is an error communicating with the provider service, an AppError with status SERVER_ERROR is thrown.
   */
  static registerProvider(body) {
    return proxyRequest(`${PROVIDER_SERVICE_URL}/provider/register`, "POST", body);
  }

  /**
   * Updates an existing provider's data by their ID.
   * @param {Number} id - The unique identifier of the provider to update.
   * @param {Object} body - The updated data for the provider.
   * @returns {Promise<Object>} A promise resolving to the updated provider object.
   * @throws {AppError} If there is an error communicating with the provider service, an AppError with status SERVER_ERROR is thrown.
   */
  static updateProvider(id, body) {
    return proxyRequest(`${PROVIDER_SERVICE_URL}/provider/update/${id}`, "PUT", body);
  }

  /**
   * Deletes a provider by their ID.
   * @param {Number} id - The unique identifier of the provider to delete.
   * @returns {Promise<Object>} A promise resolving to the deleted provider object.
   * @throws {AppError} If there is an error communicating with the provider service, an AppError with status SERVER_ERROR is thrown.
   */
  static deleteProvider(id) {
    return proxyRequest(`${PROVIDER_SERVICE_URL}/provider/delete/${id}`, "DELETE");
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  /**
   * Retrieves a list of all users.
   * @returns {Promise<Array>} A promise resolving to an array of user objects.
   * @throws {AppError} If there is an error communicating with the user service, an AppError with status SERVER_ERROR is thrown.
   */
  static getAllUsers() {
    return proxyRequest(`${USER_SERVICE_URL}/user/`);
  }

  /**
   * Retrieves a user by their unique ID.
   * @param {Number} id - The unique identifier of the user to retrieve.
   * @returns {Promise<Object>} A promise resolving to the user object.
   * @throws {AppError} If there is an error communicating with the user service, an AppError with status SERVER_ERROR is thrown.
   */
  static getUserById(id) {
    return proxyRequest(`${USER_SERVICE_URL}/user/${id}`);
  }

  /**
   * Deletes a user by their unique ID.
   * @param {Number} id - The unique identifier of the user to delete.
   * @returns {Promise<Object>} A promise resolving to the deleted user object.
   * @throws {AppError} If there is an error communicating with the user service, an AppError with status SERVER_ERROR is thrown.
   */
  static deleteUser(id) {
    return proxyRequest(`${USER_SERVICE_URL}/user/delete/${id}`, "DELETE");
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

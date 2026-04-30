import AppError from "./errors/app-error.js";
import { HttpCode } from "./constants/http-codes.js";
import { BLUE_PLUG_AUTH_TOKEN, BLUE_PLUG_BASE_URL } from "./config/env.js";

/**
 * HTTP Client for bluePlug API communication
 */
export class BluePlugHttpClient {
  #baseUrl;
  #authToken;

  constructor(baseUrl = BLUE_PLUG_BASE_URL, authToken = BLUE_PLUG_AUTH_TOKEN) {
    this.#baseUrl = baseUrl;
    this.#authToken = authToken;
  }

  /**
   * Get authorization headers
   * @returns {Object} Headers with authorization
   */
  #getHeaders() {
    const token = this.#authToken?.trim();
    const authorization = token ? `Bearer ${token}` : undefined;

    return {
      "Content-Type": "application/json",
      ...(authorization && { Authorization: authorization }),
    };
  }

  /**
   * Fetch locations from bluePlug API HTTPS endpoint
   * @returns {Promise<Array>} List of blue points
   * @throws {AppError} If request fails
   */
  async fetchLocations() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${this.#baseUrl}/locations`, {
        method: "GET",
        headers: this.#getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(
        `Fetched locations from ${this.#baseUrl} with response status:`,
        response.status,
      );
      if (!response.ok) {
        throw new AppError(
          response.status,
          "Failed to fetch locations from bluePlug API",
          `Status: ${response.status}`,
        );
      }

      const data = await response.json();
      // console.log("Response data:", data);
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new AppError(
          HttpCode.REQUEST_TIMEOUT,
          "Request timeout - bluePlug API took too long to respond",
          "Request aborted after 10 seconds",
        );
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        HttpCode.SERVER_ERROR,
        `Error communicating with bluePlug API: ${error.message}`,
      );
    }
  }

  /**
   * Fetch status for a specific charger point
   * @param {number} pointId - The charger point ID
   * @returns {Promise<Object>} Blue point with status
   * @throws {AppError} If request fails
   */
  async fetchPointStatus(pointId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `${this.#baseUrl}/location/${pointId}/status`,
        {
          method: "GET",
          headers: this.#getHeaders(),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AppError(
          response.status,
          `Failed to fetch status for point ${pointId}`,
          `Status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new AppError(
          HttpCode.REQUEST_TIMEOUT,
          `Request timeout - failed to fetch status for point ${pointId}`,
          "Request aborted after 10 seconds",
        );
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        HttpCode.SERVER_ERROR,
        "Error fetching point status from bluePlug API",
        error.message,
      );
    }
  }

  /**
   * Reserve a charger point
   * @param {number} pointId - The charger point ID
   * @param {number} minutes - Reservation duration in minutes
   * @returns {Promise<Object>} Reservation response
   * @throws {AppError} If request fails
   */
  async reservePoint(pointId, minutes) {
    try {
      const params = new URLSearchParams();
      if (minutes) params.append("minutes", minutes);

      const url = new URL(`${this.#baseUrl}/location/${pointId}/hold`);
      url.search = params.toString();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: this.#getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AppError(
          response.status,
          `Failed to reserve point ${pointId}`,
          `Status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new AppError(
          HttpCode.REQUEST_TIMEOUT,
          `Request timeout - failed to reserve point ${pointId}`,
          "Request aborted after 10 seconds",
        );
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        HttpCode.SERVER_ERROR,
        "Error reserving charger with bluePlug API",
        error.message,
      );
    }
  }
}

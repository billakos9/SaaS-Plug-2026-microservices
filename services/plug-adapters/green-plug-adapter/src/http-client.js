import AppError from "./errors/app-error.js";
import { HttpCode } from "./constants/http-codes.js";
import { GREEN_PLUG_AUTH_TOKEN, GREEN_PLUG_BASE_URL } from "./config/env.js";

/**
 * HTTP Client for greenPlug API communication.
 */
export class GreenPlugHttpClient {
  #baseUrl;
  #authToken;

  constructor(
    baseUrl = GREEN_PLUG_BASE_URL,
    authToken = GREEN_PLUG_AUTH_TOKEN,
  ) {
    this.#baseUrl = baseUrl;
    this.#authToken = authToken;
  }

  /**
   * Get authorization headers.
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
   * Fetch charger points from greenPlug API.
   * @returns {Promise<Array>} List of green plug points
   * @throws {AppError} If request fails
   */
  async fetchLocations() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.#baseUrl}/chargingPoints`, {
        method: "GET",
        headers: this.#getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(
        `Fetched charging points from ${this.#baseUrl} with response status:`,
        response.status,
      );

      if (!response.ok) {
        throw new AppError(
          response.status,
          "Failed to fetch charging points from greenPlug API",
          `Status: ${response.status}`,
        );
      }

      return response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new AppError(
          HttpCode.REQUEST_TIMEOUT,
          "Request timeout - greenPlug API took too long to respond",
          "Request aborted after 10 seconds",
        );
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        HttpCode.SERVER_ERROR,
        `Error communicating with greenPlug API: ${error.message}`,
      );
    }
  }

  /**
   * Fetch details for a single greenPlug point.
   * @param {number} pointId - The provider point ID
   * @returns {Promise<Object>} Charger point details
   * @throws {AppError} If request fails
   */
  async fetchPointStatus(pointId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.#baseUrl}/chargingPoints/${pointId}`,
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

      return response.json();
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
        "Error fetching point status from greenPlug API",
        error.message,
      );
    }
  }

  /**
   * Reserve a greenPlug charger point.
   * @param {number} pointId - The provider point ID
   * @param {number} minutes - Reservation duration in minutes
   * @returns {Promise<Object>} Reservation response
   * @throws {AppError} If request fails
   */
  async reservePoint(pointId, minutes) {
    try {
      const requestBody = { duration: minutes ?? 60 };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.#baseUrl}/chargingPoints/${pointId}/reservations`,
        {
          method: "POST",
          headers: this.#getHeaders(),
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AppError(
          response.status,
          `Failed to reserve point ${pointId}`,
          `Status: ${response.status}`,
        );
      }

      return response.json();
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
        "Error reserving charger with greenPlug API",
        error.message,
      );
    }
  }
}

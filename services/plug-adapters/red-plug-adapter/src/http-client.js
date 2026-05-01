import AppError from "./errors/app-error.js";
import { HttpCode } from "./constants/http-codes.js";
import { RED_PLUG_AUTH_TOKEN, RED_PLUG_BASE_URL } from "./config/env.js";

/**
 * HTTP Client for redPlug API communication.
 */
export class RedPlugHttpClient {
  #baseUrl;
  #authToken;

  constructor(baseUrl = RED_PLUG_BASE_URL, authToken = RED_PLUG_AUTH_TOKEN) {
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
   * Fetch redPlug points from the provider API.
   * @returns {Promise<Array>} List of red plug points
   * @throws {AppError} If request fails
   */
  async fetchLocations() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.#baseUrl}/points`, {
        method: "GET",
        headers: this.#getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(
        `Fetched points from ${this.#baseUrl} with response status:`,
        response.status,
      );

      if (!response.ok) {
        throw new AppError(
          response.status,
          "Failed to fetch points from redPlug API",
          `Status: ${response.status}`,
        );
      }

      return response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new AppError(
          HttpCode.REQUEST_TIMEOUT,
          "Request timeout - redPlug API took too long to respond",
          "Request aborted after 10 seconds",
        );
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        HttpCode.SERVER_ERROR,
        `Error communicating with redPlug API: ${error.message}`,
      );
    }
  }

  /**
   * Fetch details for a single redPlug point.
   * @param {number} pointId - The provider point ID
   * @returns {Promise<Object>} Charger point details
   * @throws {AppError} If request fails
   */
  async fetchPointStatus(pointId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.#baseUrl}/point/${pointId}`, {
        method: "GET",
        headers: this.#getHeaders(),
        signal: controller.signal,
      });

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
        "Error fetching point status from redPlug API",
        error.message,
      );
    }
  }

  /**
   * Reserve a redPlug charger point.
   * @param {number} pointId - The provider point ID
   * @param {number} minutes - Reservation duration in minutes
   * @returns {Promise<Object>} Reservation response
   * @throws {AppError} If request fails
   */
  async reservePoint(pointId, minutes) {
    try {
      const url = `${this.#baseUrl}/reserve/${pointId}${
        minutes ? `/${minutes}` : ""
      }`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
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
        "Error reserving charger with redPlug API",
        error.message,
      );
    }
  }
}

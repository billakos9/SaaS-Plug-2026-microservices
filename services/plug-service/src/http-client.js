import AppError from "./errors/app-error.js";
import { HttpCode } from "./constants/http-codes.js";

/**
 *
 * HTTP Client for Plug Adapter API communication
 * This class encapsulates all interactions with the Plug Adapter API, including fetching charger locations and statuses.
 * It handles authentication, error handling, and response parsing to provide a clean interface for the service layer.
 * It can be extended in the future to include additional API calls (e.g. reservation, cancellation) as needed.
 *
 * @class PlugAdapterHttpClient
 *
 * @example
 * const client = new PlugAdapterHttpClient();
 * const locations = await client.fetchPoints();
 * console.log(locations);
 */
export class PlugAdapterHttpClient {
  /**
   * Fetch points from Plug Adapter API
   *
   * @param {string} providerBaseUrl - The base URL of the provider's API (e.g. Blue Plug)
   *
   * @returns {Promise<Array>} List of plug points
   * @throws {AppError} If request fails
   * @example
   * const locations = await client.fetchPoints(BLUE_PLUG_BASE_URL);
   */
  async fetchPoints(providerBaseUrl) {
    try {
      console.log(`Fetching points from ${providerBaseUrl}...`);
      const chargers = await fetch(`${providerBaseUrl}/fetchPoints`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (chargers.ok) {
        return await chargers.json();
      }
      return [];
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error(`Error fetching points from ${providerBaseUrl}:`, error);
      throw new AppError(
        HttpCode.SERVER_ERROR,
        `Error communicating with ${providerBaseUrl} API`,
        error.message,
      );
    }
  }

  /**
   * Reserve a charger point through the provider's API
   *
   * @param {string} providerBaseUrl - The base URL of the provider's API (e.g. Blue Plug)
   * @param {string} chargerId - The ID of the charger to reserve
   * @param {number} minutes - The duration of the reservation in minutes
   *
   * @return {Promise<void>} Resolves when reservation is successful
   * @throws {AppError} If reservation fails
   *
   * @example
   * await client.reservePoint(BLUE_PLUG_BASE_URL, "123", 30);
   */
  async reservePoint(providerBaseUrl, chargerId, minutes) {
    try {
      const response = await fetch(`${providerBaseUrl}/postReservations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chargerId, minutes }),
      });

      if (!response.ok) {
        throw new AppError(
          HttpCode.SERVER_ERROR,
          `Error communicating with ${providerBaseUrl} API`,
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        HttpCode.SERVER_ERROR,
        `Error communicating with ${providerBaseUrl} API`,
        error.message,
      );
    }
  }
}

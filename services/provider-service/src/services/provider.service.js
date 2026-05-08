import { HttpCode } from "../constants/http-codes.js";
import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import AppError from "../errors/app-error.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";
import ProviderRepository from "../repositories/provider.repository.js";

class ProviderService {
  /**
   * Returns all registered providers from the database.
   *
   * @returns {Promise<Object[]>} Array of all provider records.
   */
  static async getAll() {
    return ProviderRepository.getAll();
  }

  /**
   * Returns a single provider by its numeric id.
   *
   * @param {number} id - The numeric id of the provider to retrieve.
   * @returns {Promise<Object>} The matching provider document.
   * @throws {AppError} 404 if no provider with the given id exists.
   */
  static async getById(id) {
    const provider = await ProviderRepository.getById(id);
    if (!provider) throw new AppError(HttpCode.NOT_FOUND, "Provider not found");
    return provider;
  }

  /**
   * Validates, persists a new provider, and publishes a provider.add event.
   *
   * @param {Object} providerData - Validated provider registration data from the DTO layer.
   * @param {string} providerData.providerName - Name of the provider.
   * @param {string} providerData.email - Provider contact email.
   * @param {string} providerData.password - Provider account password.
   * @param {string} providerData.apiBaseUrl - Base URL of the provider's charging API.
   * @param {string} providerData.apiKey - API key for authenticating with the provider.
   * @returns {Promise<Object>} The newly created provider document.
   * @throws {AppError} 400 if any required field is missing.
   */
  static async registerProvider(providerData) {
    if (!providerData.providerName || !providerData.email) {
      throw new AppError(HttpCode.BAD_REQUEST, "Name and email are required");
    }
    if (!providerData.password) {
      throw new AppError(HttpCode.BAD_REQUEST, "Password is required");
    }
    if (!providerData.apiBaseUrl) {
      throw new AppError(HttpCode.BAD_REQUEST, "API base URL is required");
    }
    if (!providerData.apiKey) {
      throw new AppError(HttpCode.BAD_REQUEST, "API key is required");
    }

    const providerId = await ProviderRepository.getNextId();
    const newProvider = await ProviderRepository.create({ ...providerData, providerId });

    await publishEvent(Exchanges.PROVIDER, RoutingKeys.PROVIDER_ADD, {
      providerId: newProvider.providerId,
      providerName: newProvider.providerName,
      apiBaseUrl: newProvider.apiBaseUrl,
    });

    return newProvider;
  }

  /**
   * Applies a partial update to a provider and publishes a provider.update event.
   *
   * @param {Object} providerData - Partial provider data including the mandatory providerId.
   * @param {number} providerData.providerId - Id of the provider to update.
   * @returns {Promise<Object>} The updated provider document.
   * @throws {AppError} 400 if providerId is missing.
   * @throws {AppError} 404 if no provider with the given id exists.
   */
  static async updateProvider(providerData) {
    if (!providerData.providerId) {
      throw new AppError(HttpCode.BAD_REQUEST, "Provider ID is required for update");
    }

    const updated = await ProviderRepository.update(providerData);
    if (!updated) throw new AppError(HttpCode.NOT_FOUND, "Provider not found");

    await publishEvent(Exchanges.PROVIDER, RoutingKeys.PROVIDER_UPDATE, {
      providerId: updated.providerId,
      providerName: updated.providerName,
      apiBaseUrl: updated.apiBaseUrl,
    });

    return updated;
  }

  /**
   * Deletes a provider by id and publishes a provider.delete event.
   *
   * @param {number} providerId - The numeric id of the provider to delete.
   * @returns {Promise<{ deletedCount: number }>} Mongoose deleteOne result.
   * @throws {AppError} 400 if providerId is missing.
   * @throws {AppError} 404 if no provider with the given id exists.
   */
  static async deleteProvider(providerId) {
    if (!providerId) {
      throw new AppError(HttpCode.BAD_REQUEST, "Provider ID is required for deletion");
    }

    const result = await ProviderRepository.delete(providerId);
    if (result.deletedCount === 0) {
      throw new AppError(HttpCode.NOT_FOUND, "Provider not found");
    }

    await publishEvent(Exchanges.PROVIDER, RoutingKeys.PROVIDER_DELETE, { providerId });

    return result;
  }
}

export default ProviderService;

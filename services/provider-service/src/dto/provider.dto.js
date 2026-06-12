import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

/**
 * Validates and maps raw request body into a provider registration request DTO.
 *
 * @param {Object} input - Raw request body from the client.
 * @param {string} input.providerName - Name of the provider.
 * @param {string} input.email - Provider contact email.
 * @param {string} input.password - Provider account password.
 * @param {string} input.apiBaseUrl - Base URL of the provider's charging API.
 * @param {string} input.apiKey - API key for authenticating with the provider.
 * @returns {{ providerName: string, apiBaseUrl: string, apiKey: string, email: string, password: string }} Validated and trimmed provider data.
 * @throws {AppError} 400 if any required field is missing or blank.
 */
export function toProviderRegistrationRequestDTO(input) {
  if (!input) throw new AppError(HttpCode.BAD_REQUEST, "Request body is required");

  if (!input.providerName?.trim()) throw new AppError(HttpCode.BAD_REQUEST, "providerName is required");
  if (!input.email?.trim())        throw new AppError(HttpCode.BAD_REQUEST, "email is required");
  if (!input.password?.trim())     throw new AppError(HttpCode.BAD_REQUEST, "password is required");
  if (!input.apiBaseUrl?.trim())   throw new AppError(HttpCode.BAD_REQUEST, "apiBaseUrl is required");
  if (!input.apiKey?.trim())       throw new AppError(HttpCode.BAD_REQUEST, "apiKey is required");

  return {
    providerName: input.providerName.trim(),
    apiBaseUrl:   input.apiBaseUrl.trim(),
    apiKey:       input.apiKey.trim(),
    email:        input.email.trim(),
    password:     input.password.trim(),
  };
}

/**
 * Validates and maps route param and request body into a provider update request DTO.
 * Only fields present in the body are included in the returned object.
 *
 * @param {string|number} id - Provider numeric id taken from the route parameter.
 * @param {Object} input - Raw request body containing fields to update.
 * @returns {{ providerId: number, providerName?: string, apiBaseUrl?: string, apiKey?: string, email?: string, password?: string }} Partial provider update object.
 * @throws {AppError} 400 if the request body is missing or the id is not a valid number.
 */
export function toProviderUpdateRequestDTO(id, input) {
  if (!input) throw new AppError(HttpCode.BAD_REQUEST, "Request body is required");

  const providerId = Number(id);
  if (Number.isNaN(providerId)) throw new AppError(HttpCode.BAD_REQUEST, "Invalid providerId");

  const dto = { providerId };
  if (input.providerName !== undefined) dto.providerName = String(input.providerName).trim();
  if (input.apiBaseUrl !== undefined)   dto.apiBaseUrl   = String(input.apiBaseUrl).trim();
  if (input.apiKey !== undefined)       dto.apiKey       = String(input.apiKey).trim();
  if (input.email !== undefined)        dto.email        = String(input.email).trim();
  if (input.password !== undefined)     dto.password     = String(input.password).trim();

  return dto;
}

/**
 * Maps a newly created provider document into the registration response DTO.
 *
 * @param {Object} data - The provider document returned from the service layer.
 * @param {number} data.providerId - Assigned numeric provider id.
 * @param {string} data.providerName - Registered provider name.
 * @returns {{ providerId: number, providerName: string, timestamp: string }} Registration confirmation object.
 */
export function toProviderRegisteredDTO(data) {
  return {
    providerId:   data.providerId,
    providerName: data.providerName,
    timestamp:    new Date().toISOString(),
  };
}

/**
 * Maps an updated provider document into the update response DTO.
 *
 * @param {Object} data - The updated provider document returned from the service layer.
 * @param {number} data.providerId - Provider numeric id.
 * @param {string} data.providerName - Updated provider name.
 * @param {string} data.apiBaseUrl - Updated API base URL.
 * @param {string} data.email - Updated contact email.
 * @returns {{ providerId: number, providerName: string, apiBaseUrl: string, email: string, timestamp: string }} Updated provider summary with timestamp.
 */
export function toProviderUpdatedDTO(data) {
  return {
    providerId:   data.providerId,
    providerName: data.providerName,
    apiBaseUrl:   data.apiBaseUrl,
    email:        data.email,
    timestamp:    new Date().toISOString(),
  };
}

/**
 * Maps an array of provider documents into the public list DTO (omits apiKey and password).
 *
 * @param {Object[]} providers - Array of provider documents from the repository.
 * @returns {{ providerId: number, providerName: string, apiBaseUrl: string }[]} Array of public provider summaries.
 */
export function toProviderListDTO(providers) {
  return providers.map((p) => ({
    providerId:   p.providerId,
    providerName: p.providerName,
    apiBaseUrl:   p.apiBaseUrl,
  }));
}

export function toProviderDetailDTO(p) {
  return {
    providerId:   p.providerId,
    providerName: p.providerName,
    email:        p.email,
    apiBaseUrl:   p.apiBaseUrl,
  };
}

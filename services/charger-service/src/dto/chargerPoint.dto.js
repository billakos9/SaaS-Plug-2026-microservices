import { validChargerPointStatus } from "../constants/charger-status.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

/**
 * Normalizes and validates a ChargerPoint payload into a DTO
 *
 * @param {any} input - Raw input (e.g. req.body)
 * @returns {{
 *  id: number,
 *  ProviderName: string,
 *  longitude: string,
 *  latitude: string,
 *  status: string,
 *  cap: number,
 *  kwhPrice: number,
 *  address: string,
 *  locationName: string,
 *  connectionType: string
 * }} ChargerPoint DTO
 * @throws {AppError} If required fields are missing or invalid
 */
export function toChargerPointDTO(input) {
  if (!input) throw new AppError(HttpCode.BAD_REQUEST, "Input is required");

  const dto = {
    id: Number(input.id),
    ProviderName: String(input.ProviderName ?? input.providerName ?? ""),
    status: String(input.status),
  };

  if (input.longitude      !== undefined) dto.longitude      = String(input.longitude);
  if (input.latitude       !== undefined) dto.latitude       = String(input.latitude);
  if (input.cap            !== undefined) dto.cap            = Number(input.cap);
  if (input.kwhPrice       !== undefined) dto.kwhPrice       = Number(input.kwhPrice);
  if (input.address        !== undefined) dto.address        = String(input.address);
  if (input.locationName   !== undefined) dto.locationName   = String(input.locationName);
  if (input.connectionType !== undefined) dto.connectionType = String(input.connectionType);

  if (Number.isNaN(dto.id) || dto.id <= 0)
    throw new AppError(HttpCode.BAD_REQUEST, "Invalid id");
  if (dto.cap !== undefined && Number.isNaN(dto.cap))
    throw new AppError(HttpCode.BAD_REQUEST, "Invalid cap");
  if (dto.kwhPrice !== undefined && Number.isNaN(dto.kwhPrice))
    throw new AppError(HttpCode.BAD_REQUEST, "Invalid kwhPrice");

  validChargerPointStatus(dto.status);

  return dto;
}

/**
 * Maps a list of documents into response DTOs
 *
 * @param {Array<Object>} docs
 * @returns {Array<Object>} List of ChargerPoint response DTOs
 */
export function toChargerPointDTOList(docs) {
  return docs.map(toChargerPointDTO);
}

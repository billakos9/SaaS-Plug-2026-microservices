import { validChargerPointStatus } from "../constants/charger-status.js";
import AppError from "../errors/app-error.js";

/**
 * Normalizes and validates a ChargerPoint payload into a DTO.
 *
 * @param {any} input
 * @returns {{id:number,ProviderName:string,longitude:string,latitude:string,location:Object,status:string,cap:number,kwhPrice:number,address:string,locationName:string,connectionType:string}}
 * @throws {AppError} If required fields are missing or invalid
 */
export function toChargerPointDTO(input) {
  if (!input) throw new AppError("Input is required");
  const dto = {
    id: Number(input.id),
    ProviderName: String(input.ProviderName),
    longitude: String(input.longitude),
    latitude: String(input.latitude),
    location: {
      type: "Point",
      coordinates: [Number(input.longitude) || 0, Number(input.latitude) || 0],
    },
    status: String(input.status),
    cap: Number(input.cap),
    kwhPrice: Number(input.kwhPrice),
    address: String(input.address),
    locationName: String(input.locationName),
    connectionType: String(input.connectionType),
  };

  if (Number.isNaN(dto.id)) throw new AppError("Invalid id");
  if (Number.isNaN(dto.cap)) throw new AppError("Invalid cap");
  if (Number.isNaN(dto.kwhPrice)) throw new AppError("Invalid kwhPrice");
  validChargerPointStatus(dto.status);

  return dto;
}

/**
 * Maps a list of charger point documents to response DTOs.
 *
 * @param {Array<Object>} docs
 * @returns {Array<Object>} List of ChargerPoint DTOs
 */
export function toChargerPointDTOList(docs) {
  return docs.map(toChargerPointDTO);
}

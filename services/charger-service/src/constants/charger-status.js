import AppError from "../errors/app-error.js";
import { HttpCode } from "./http-codes.js";

/**
 * A class containing all the supported values for Charger Point status and their string object.
 */
export const ChargerStatus = Object.freeze({
  AVAILABLE: "available",
  CHARGING: "charging",
  RESERVED: "reserved",
  MALFUNCTION: "malfunction",
  OFFLINE: "offline",
});

/**
 * A simple function that checks if a given status is supported by the application.
 *
 * @param {string} status The status string that needs to be validated.
 * @returns {boolean} True if the status is supported.
 *
 * @throws AppError in case the status is not supported.
 */
export function validChargerPointStatus(status) {
  if (status && !Object.values(ChargerStatus).includes(status)) {
    throw new AppError(
      HttpCode.BAD_REQUEST,
      `Used invalid station status: ${status}`,
      `Accepted values: ${Object.values(ChargerStatus).join(", ")}`,
    );
  }

  return true;
}

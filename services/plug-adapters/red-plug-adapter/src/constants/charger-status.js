import AppError from "../errors/app-error.js";
import { HttpCode } from "./http-codes.js";

/**
 * Supported charger status values.
 */
export const ChargerStatus = Object.freeze({
  AVAILABLE: "available",
  CHARGING: "charging",
  RESERVED: "reserved",
  MALFUNCTION: "malfunction",
  OFFLINE: "offline",
});

/**
 * Validates that a charger point status is supported.
 *
 * @param {string} status
 * @returns {boolean}
 * @throws {AppError} If status is invalid.
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

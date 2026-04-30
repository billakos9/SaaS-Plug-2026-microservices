import { toChargerPointDTOList } from "../dto/chargerPoint.dto.js";
import BluePlugAdapterService from "../services/blue-plug-adapter.service.js";

/**
 * Handles GET /
 * Retrieves all charger points
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON array of charger points
 */
export const getAllChargerPoints = async (req, res) => {
  const chargerPointList = await BluePlugAdapterService.getAll();

  res.json(toChargerPointDTOList(chargerPointList));
};

/**
 * Handles POST /
 * Forwards reservation to the charger provider and updates charger point status to "reserved"
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON of created charger point
 */
export const reserveChargerPoint = async (req, res) => {
  const { providerName, chargerId, minutes } = req.body;

  await BluePlugAdapterService.reserve(providerName, chargerId, minutes);
  res.json({ message: "Charger reserved successfully" });
};

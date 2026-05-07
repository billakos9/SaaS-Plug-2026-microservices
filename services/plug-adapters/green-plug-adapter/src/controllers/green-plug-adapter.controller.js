import { toChargerPointDTOList } from "../dto/chargerPoint.dto.js";
import GreenPlugAdapterService from "../services/green-plug-adapter.service.js";

/**
 * Handles GET /fetchPoints
 * Retrieves all charger points and transforms them into response DTOs.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON array of charger points
 */
export const getAllChargerPoints = async (req, res) => {
  const chargerPointList = await GreenPlugAdapterService.getAll();
  res.json(toChargerPointDTOList(chargerPointList));
};

/**
 * Handles POST /postReservations
 * Reserves a charger point through the provider adapter.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends success message
 */
export const reserveChargerPoint = async (req, res) => {
  const { providerName, chargerId, minutes } = req.body;

  await GreenPlugAdapterService.reserve(providerName, chargerId, minutes);
  res.json({ message: "Charger reserved successfully" });
};

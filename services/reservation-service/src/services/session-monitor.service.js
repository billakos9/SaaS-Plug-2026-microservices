import Reservation from "../models/reservation.model.js";
import ReservationService from "./reservation.service.js";

class SessionMonitorService {
  /**
   * Periodically checks for expired reservations and completes them.
   * Runs every 30 seconds.
   */
  static start() {
    console.log("Session Monitor Service started");
    setInterval(async () => {
      try {
        await this.checkExpiredReservations();
      } catch (error) {
        console.error("Error in Session Monitor:", error);
      }
    }, 5000); // Check every 5 seconds
  }

  static async checkExpiredReservations() {
    const now = new Date();
    
    // Find active reservations where createdAt + duration < now
    // We iterate through them because duration can vary per reservation.
    // However, we can filter for candidates that have definitely expired.
    // For most, duration is 30 mins, so we only check those created > 30 mins ago.
    const candidates = await Reservation.find({ 
      status: "active",
      createdAt: { $lt: new Date(now.getTime() - 60000) } // At least 1 min old to avoid race conditions
    });

    for (const res of candidates) {
      const expirationTime = new Date(res.createdAt.getTime() + res.duration * 60000);
      
      if (now > expirationTime) {
        console.log(`Reservation ${res.reservationId} expired. Completing...`);
        await ReservationService.complete(res.reservationId);
      }
    }
  }
}

export default SessionMonitorService;

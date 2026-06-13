const PC_MAP = {
  "174 56": { lat: 37.915, lon: 23.722 },
  "174 55": { lat: 37.912, lon: 23.715 },
  "151 23": { lat: 38.033, lon: 23.805 },
  "136 72": { lat: 38.083, lon: 23.723 },
  "131 22": { lat: 38.031, lon: 23.702 },
  "171 22": { lat: 37.947, lon: 23.714 },
  "190 05": { lat: 38.083, lon: 23.978 },
  "114 74": { lat: 37.994, lon: 23.738 },
  "153 42": { lat: 38.012, lon: 23.818 },
};

class NominatimQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.delayMs = 1100; // 1.1s delay
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      
      if (timeSinceLast < this.delayMs) {
        await new Promise(r => setTimeout(r, this.delayMs - timeSinceLast));
      }

      const { task, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();
      
      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }

    this.isProcessing = false;
  }
}

const queue = new NominatimQueue();

export const parseCoords = (text) => {
  if (!text || typeof text !== "string") return null;
  const regex = /(-?\d{1,2}\.\d+)\s*[,/;\s]\s*(-?\d{1,3}\.\d+)/;
  const match = text.match(regex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      const isGreekRange = lat > 34 && lat < 42 && lon > 19 && lon < 29;
      const hasPrecision = match[1].split('.')[1].length > 2 || match[2].split('.')[1].length > 2;
      if (isGreekRange || hasPrecision) return { lat: String(lat), lon: String(lon) };
    }
  }
  return null;
};

export const getPC = (address) => {
  if (!address || typeof address !== "string") return null;
  // Matches 123 45 or 12345
  const match = address.match(/\b\d{3}\s?\d{2}\b/);
  if (match) return match[0].replace(/\s/g, " ");
  
  const matchNoSpace = address.match(/\b\d{5}\b/);
  if (matchNoSpace) {
    const s = matchNoSpace[0];
    return s.slice(0, 3) + " " + s.slice(3);
  }
  return null;
};

export const geocodeAddress = async (address) => {
  if (!address || address === "Unknown") return null;
  
  return queue.add(async () => {
    try {
      const query = new URLSearchParams({
        q: address,
        format: 'json',
        limit: 1
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, {
        headers: {
          'User-Agent': 'saasPlug-charger-service/1.0'
        }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: data[0].lat,
          lon: data[0].lon,
          displayName: data[0].display_name
        };
      }
      return null;
    } catch (e) {
      console.error("Geocoding failed for address:", address, e);
      return null;
    }
  });
};

export const reverseGeocode = async (lat, lon) => {
  if (!lat || !lon) return null;

  return queue.add(async () => {
    try {
      const query = new URLSearchParams({
        lat,
        lon,
        format: 'json'
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`, {
        headers: {
          'User-Agent': 'saasPlug-charger-service/1.0'
        }
      });
      const data = await res.json();
      if (data && data.display_name) {
        return data.display_name;
      }
      return null;
    } catch (e) {
      console.error("Reverse geocoding failed for coords:", lat, lon, e);
      return null;
    }
  });
};

export const enrichLocationData = async (chargerData) => {
  let lat = chargerData.latitude || "0";
  let lon = chargerData.longitude || "0";
  let address = chargerData.address || "Unknown";

  const isInvalidCoord = (c) => !c || parseFloat(c) === 0;

  if (isInvalidCoord(lat) || isInvalidCoord(lon)) {
    // 1. Try to parse from address string
    const fromAddr = parseCoords(address);
    if (fromAddr) {
      lat = fromAddr.lat;
      lon = fromAddr.lon;
    } else {
      // 2. Try to match Postal Code
      const pc = getPC(address);
      if (pc && PC_MAP[pc]) {
        lat = String(PC_MAP[pc].lat);
        lon = String(PC_MAP[pc].lon);
      } else {
        // 3. Try geocoding the address
        if (address !== "Unknown") {
           const geo = await geocodeAddress(address);
           if (geo) {
             lat = String(geo.lat);
             lon = String(geo.lon);
           }
        }
      }
    }
  }

  // 4. Reverse geocode if address is "Unknown" or looks like coordinates
  if ((address === "Unknown" || parseCoords(address)) && !isInvalidCoord(lat) && !isInvalidCoord(lon)) {
    const revGeo = await reverseGeocode(lat, lon);
    if (revGeo) {
      address = revGeo;
    }
  }

  // Final fallback
  if (isInvalidCoord(lat)) lat = "37.9838";
  if (isInvalidCoord(lon)) lon = "23.7275";

  // Update location array if available
  const newLat = parseFloat(lat);
  const newLon = parseFloat(lon);
  
  const updatedData = {
    ...chargerData,
    latitude: String(lat),
    longitude: String(lon),
    address: address
  };

  if (updatedData.location && updatedData.location.type === "Point") {
    updatedData.location = {
      ...updatedData.location,
      coordinates: [newLon, newLat]
    };
  }

  return updatedData;
};

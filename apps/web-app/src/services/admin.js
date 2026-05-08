import http from "./http";

export async function healthCheck() {
  const res = await http.get("/admin/healthcheck", {
    params: { format: "json" },
  });

  return res.data;
}

export async function resetPoints() {
  const res = await http.post("/admin/resetpoints");
  return res.data;
}

export async function addPoints(csvFile) {
  if (!csvFile) {
    throw new Error("A CSV file is required");
  }

  const formData = new FormData();
  formData.append("file", csvFile);

  const res = await http.post("/admin/addpoints", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

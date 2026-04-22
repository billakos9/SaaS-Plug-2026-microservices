import express from "express";
import mongoose from "mongoose";

const app = express();
const PORT = 3000;

app.use(express.json());

mongoose
  .connect("mongodb://charger-db:27017/charger")
  .then(() => {
    console.log("Connected to charger DB");
  })
  .catch((err) => {
    console.log(`Error in connecting with charger DB: ${err}`);
  });

const ChargerSchema = new mongoose.Schema({ id: Number, name: String });

const charger = mongoose.model("charger", ChargerSchema);
app.get("/", (req, res) => {
  res.send("hello world");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;

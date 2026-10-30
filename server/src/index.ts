import express from "express";
import cors from "cors"
import { campaignRouter } from "./routes/campaign.routes.js";

const app = express();
app.use(express.json());

const PORT = 3000;

app.use("/api/campaigns", campaignRouter);

//healthy
app.get("/", (req, res) => {
  res.status(200).json({
    message: "healthy",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
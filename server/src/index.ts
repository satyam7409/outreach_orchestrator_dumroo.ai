import express from "express";
import cors from "cors"
import { campaignRouter } from "./routes/campaign.routes.js";
import { leadRouter } from "./routes/lead.routes.js";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;

app.use("/api/campaigns", campaignRouter);
app.use("/api/leads", leadRouter);

//healthy
app.get("/", (req, res) => {
  res.status(200).json({
    message: "healthy",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

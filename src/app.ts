import express from "express";
import type { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes";

const app: Application = express();

app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());
app.use("/api", routes);

export default app;

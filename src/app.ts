import express from "express";
import type { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import morganMiddleware from "./logger/morgan.logger";
import session from "express-session";

const app: Application = express();

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(
  cors({
    origin: "*",
  })
);
app.use(cookieParser());

app.use(
  session({
    secret: process.env.EXPRESS_SESSION_SECRET as string,
    resave: true,
    saveUninitialized: true,
  })
);


app.use(passport.initialize());
app.use(passport.session());
app.use(morganMiddleware);

import healthCheckRouter from "./routes/healthcheck.routes";
import userRouter from "./routes/auth/user.routes";
import { errorHandler } from "./middlewares/error.middleware";

app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/users", userRouter);

app.use(errorHandler);
export default app;

import { Router } from "express";
import { healthCheck } from "../controllers/healthcheck.controller";
import { ApiResponse } from "../utils/ApiResponse";

const router = Router();


router.route("/").get(healthCheck);



export default router;

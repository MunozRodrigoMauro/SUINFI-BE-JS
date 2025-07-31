import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import {
  addFavorite,
  removeFavorite,
  getFavorites,
} from "../controllers/favorite.controller.js";

const router = express.Router();

router.post("/", verifyToken, addFavorite);
router.delete("/", verifyToken, removeFavorite);
router.get("/", verifyToken, getFavorites);

export default router;

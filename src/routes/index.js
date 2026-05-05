import express from "express";
import authRouter from "./auth.js";
import tagsRouter from "./tags.js";
import questionRoutes from "./questions.js";
import answerRoutes from "./answers.js";

const router = express.Router();

// Route for user registration
router.use("/auth", authRouter);

// Add question and answer routes
router.use("/questions", questionRoutes);
router.use("/answers", answerRoutes);

// Routes for Tags
router.use("/tags", tagsRouter);

export default router;

import express from "express";
import authHandler from "../middleware/authHandler.js";
import { createQuestion, getAllQuestions, getQuestionById, updateQuestion, deleteQuestion, upvoteQuestion, downvoteQuestion } from "../controllers/questionController.js";
import { getAnswersByQuestionId, createAnswer } from "../controllers/answerController.js";

const router = express.Router();

router.get("/", getAllQuestions);
router.get("/:id", getQuestionById);
router.get("/:questionId/answers", getAnswersByQuestionId);

router.post("/", authHandler, createQuestion);
router.put("/:id", authHandler, updateQuestion);
router.delete("/:id", authHandler, deleteQuestion);
router.post("/:id/upvote", authHandler, upvoteQuestion);
router.post("/:id/downvote", authHandler, downvoteQuestion);
router.post("/:questionId/answers", authHandler, createAnswer);

export default router;
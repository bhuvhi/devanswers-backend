import express from "express";
import authHandler from "../middleware/authHandler.js";
import { updateAnswer, deleteAnswer, upvoteAnswer, downvoteAnswer } from "../controllers/answerController.js";

const router = express.Router();

router.put("/:answerId", authHandler, updateAnswer);
router.delete("/:answerId", authHandler, deleteAnswer);
router.post("/:answerId/upvote", authHandler, upvoteAnswer);
router.post("/:answerId/downvote", authHandler, downvoteAnswer);

export default router;
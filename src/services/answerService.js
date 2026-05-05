import Question from "../models/Question.js";
import Answer from "../models/Answer.js";
import { createAppError } from "../utils/createAppError.js";
import { handleVote } from "./voteService.js";

export const getAnswersByQuestionIdService = async (questionId) => {
  const answers = await Answer.find({ questionId })
    .populate({ path: 'author', select: 'name' })
    .sort({ createdAt: -1 });

  if (!answers || answers.length === 0) {
    throw createAppError('No answers found for this question', 404);
  }

  return answers;
};

export const createAnswerService = async (questionId, answerText, author) => {
  const answer = await Answer.create({
    questionId,
    answerText,
    author,
  });

  const populatedAnswer = await Answer.findById(answer._id)
    .populate({ path: 'author', select: 'name' });

  return populatedAnswer;
};

export const updateAnswerService = async (answerId, answerText, loggedInUser) => {
  const answer = await Answer.findById(answerId);

  if (!answer) {
    throw createAppError('Answer not found', 404);
  }

  const isOwner = answer.author.toString() === String(loggedInUser?.id);
  const isAdmin = Boolean(loggedInUser?.isAdmin);

  if (!isOwner && !isAdmin) {
    throw createAppError('You are not authorized to update this answer', 403);
  }

  answer.answerText = answerText;
  await answer.save();

  const updatedAnswer = await Answer.findById(answer._id)
    .populate({ path: 'author', select: 'name' });

  return updatedAnswer;
};

export const deleteAnswerService = async (answerId, loggedInUser) => {
  const answer = await Answer.findById(answerId);

  if (!answer) {
    throw createAppError('Answer not found', 404);
  }

  const isOwner = answer.author.toString() === String(loggedInUser?.id);
  const isAdmin = Boolean(loggedInUser?.isAdmin);

  if (!isOwner && !isAdmin) {
    throw createAppError('You are not authorized to delete this answer', 403);
  }

  await Answer.findByIdAndDelete(answerId);

  return {
    success: true,
    message: 'Answer deleted successfully',
  };
};

export const upvoteAnswerService = async (answerId, userId) => {
  const updatedAnswer = await handleVote(Answer, answerId, userId, 'upvote');

  if (!updatedAnswer) {
    throw createAppError('Failed to upvote answer', 400);
  }

  return updatedAnswer;
};

export const downvoteAnswerService = async (answerId, userId) => {
  const updatedAnswer = await handleVote(Answer, answerId, userId, 'downvote');

  if (!updatedAnswer) {
    throw createAppError('Failed to downvote answer', 400);
  }

  return updatedAnswer;
};
import Question from '../models/Question.js';
import Tag from '../models/Tag.js';
import Answer from '../models/Answer.js';
import { createAppError } from '../utils/createAppError.js';
import { handleVote } from './voteService.js';

export const getAllQuestionsService = async () => {
  const questions = await Question.find()
    .populate({ path: 'author', select: 'name' })
    .populate('tags')
    .sort({ createdAt: -1 });

  if (!questions || questions.length === 0) {
    throw createAppError('No questions found', 404);
  }

  const questionsWithAnswerCount = await Promise.all(
    questions.map(async (question) => {
      const answerCount = await Answer.countDocuments({ questionId: question._id });
      return {
        ...question.toObject(),
        answerCount,
      };
    })
  );

  return questionsWithAnswerCount;
};

export const getQuestionByIdService = async (id) => {
  const question = await Question.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true }
  )
    .populate({ path: 'author', select: 'name' })
    .populate('tags');

  if (!question) {
    throw createAppError('Question not found', 404);
  }

  const answers = await Answer.find({ questionId: id })
    .populate({ path: 'author', select: 'name' })
    .sort({ createdAt: -1 });

  return {
    ...question.toObject(),
    answers,
  };
};

export const createQuestionService = async (title, description, tags, author) => {
  const tagNames = (Array.isArray(tags) ? tags : String(tags || '').split(','))
    .map((tag) => String(tag).trim())
    .filter(Boolean);

  const tagDocs = await Promise.all(
    tagNames.map(async (name) => {
      const existingTag = await Tag.findOne({ name });
      if (existingTag) {
        return existingTag;
      }

      return Tag.create({ name });
    })
  );

  const question = new Question({
    title,
    description,
    tags: tagDocs.map((tag) => tag._id),
    author,
  });

  await question.save();
  return question;
};

export const updateQuestionService = async (
  id,
  title,
  description,
  tags,
  loggedInUser
) => {
  const question = await Question.findById(id);

  if (!question) {
    throw createAppError('Question not found', 404);
  }

  const isOwner = question.author.toString() === String(loggedInUser?.id);
  const isAdmin = Boolean(loggedInUser?.isAdmin);

  if (!isOwner && !isAdmin) {
    throw createAppError('You are not authorized to update this question', 403);
  }

  const tagNames = (Array.isArray(tags) ? tags : String(tags || '').split(','))
    .map((tag) => String(tag).trim())
    .filter(Boolean);

  const tagDocs = await Promise.all(
    tagNames.map(async (name) => {
      const existingTag = await Tag.findOne({ name });
      if (existingTag) {
        return existingTag;
      }

      return Tag.create({ name });
    })
  );

  question.title = title;
  question.description = description;
  question.tags = tagDocs.map((tag) => tag._id);

  await question.save();

  const updatedQuestion = await Question.findById(question._id)
    .populate({ path: 'author', select: 'name' })
    .populate('tags');

  return updatedQuestion;
};

export const deleteQuestionService = async (id, loggedInUser) => {
  const question = await Question.findById(id);

  if (!question) {
    throw createAppError('Question not found', 404);
  }

  const isOwner = question.author.toString() === String(loggedInUser?.id);
  const isAdmin = Boolean(loggedInUser?.isAdmin);

  if (!isOwner && !isAdmin) {
    throw createAppError('You are not authorized to delete this question', 403);
  }

  await Answer.deleteMany({ questionId: question._id });
  await Question.findByIdAndDelete(question._id);

  return {
    success: true,
    message: 'Question deleted successfully',
  };
};

export const upvoteQuestionService = async (questionId, userId) => {
  const updatedQuestion = await handleVote(Question, questionId, userId, 'upvote');

  if (!updatedQuestion) {
    throw createAppError('Failed to upvote question', 400);
  }

  return updatedQuestion;
};

export const downvoteQuestionService = async (questionId, userId) => {
  const updatedQuestion = await handleVote(Question, questionId, userId, 'downvote');

  if (!updatedQuestion) {
    throw createAppError('Failed to downvote question', 400);
  }

  return updatedQuestion;
};
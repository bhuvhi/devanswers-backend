import {
  getAllQuestionsService,
  getQuestionByIdService,
  createQuestionService,
  updateQuestionService,
  deleteQuestionService,
  upvoteQuestionService,
  downvoteQuestionService,
} from '../services/questionService.js';

export const getAllQuestions = async (req, res) => {
  const questions = await getAllQuestionsService();

  res.status(200).json({
    success: true,
    message: 'Questions fetched successfully',
    data: questions,
  });
};

export const getQuestionById = async (req, res) => {
  const { id } = req.params;
  const question = await getQuestionByIdService(id);

  res.status(200).json({
    success: true,
    message: 'Question fetched successfully',
    data: question,
  });
};

export const createQuestion = async (req, res) => {
  const { title, description, tags } = req.body;
  const author = req.user.id;

  const question = await createQuestionService(title, description, tags, author);

  res.status(201).json({
    success: true,
    message: 'Question created successfully',
    data: question,
  });
};

export const updateQuestion = async (req, res) => {
  const { id } = req.params;
  const { title, description, tags } = req.body;

  const question = await updateQuestionService(id, title, description, tags, req.user);

  res.status(200).json({
    success: true,
    message: 'Question updated successfully',
    data: question,
  });
};

export const deleteQuestion = async (req, res) => {
  const { id } = req.params;

  const result = await deleteQuestionService(id, req.user);

  res.status(200).json({
    success: true,
    message: result.message,
    data: result,
  });
};

export const upvoteQuestion = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const question = await upvoteQuestionService(id, userId);

  res.status(200).json({
    success: true,
    message: 'Question upvoted successfully',
    data: question,
  });
};

export const downvoteQuestion = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const question = await downvoteQuestionService(id, userId);

  res.status(200).json({
    success: true,
    message: 'Question downvoted successfully',
    data: question,
  });
};

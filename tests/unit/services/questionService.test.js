import '../../setup.js';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

import User from '../../../src/models/User.js';
import Tag from '../../../src/models/Tag.js';
import Question from '../../../src/models/Question.js';
import Answer from '../../../src/models/Answer.js';

import {
  getAllQuestionsService,
  getQuestionByIdService,
  createQuestionService,
  updateQuestionService,
  deleteQuestionService,
  upvoteQuestionService,
  downvoteQuestionService,
} from '../../../src/services/questionService.js';
import * as voteService from '../../../src/services/voteService.js';

let userCounter = 0;

const createUser = async (overrides = {}) => {
  userCounter += 1;
  return User.create({
    name: overrides.name ?? `User ${userCounter}`,
    email: overrides.email ?? `user${userCounter}@test.com`,
    password: overrides.password ?? 'password123',
    isAdmin: overrides.isAdmin ?? false,
  });
};

beforeEach(async () => {
  await Promise.all([
    Answer.deleteMany({}),
    Question.deleteMany({}),
    Tag.deleteMany({}),
    User.deleteMany({}),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAllQuestionsService', () => {
  it('returns questions with populated author, tags, and answerCount', async () => {
    const author = await createUser({ name: 'Alice' });
    const tag1 = await Tag.create({ name: 'javascript' });
    const tag2 = await Tag.create({ name: 'nodejs' });

    const question = await Question.create({
      title: 'Q1',
      description: 'D1',
      author: author._id,
      tags: [tag1._id, tag2._id],
    });

    await Answer.create({
      questionId: question._id,
      answerText: 'A1',
      author: author._id,
    });
    await Answer.create({
      questionId: question._id,
      answerText: 'A2',
      author: author._id,
    });

    const result = await getAllQuestionsService();

    expect(result).toHaveLength(1);
    expect(result[0].author.name).toBe('Alice');
    expect(result[0].tags).toHaveLength(2);
    expect(result[0].answerCount).toBe(2);
  });

  it('throws 404 AppError when no questions exist', async () => {
    await expect(getAllQuestionsService()).rejects.toMatchObject({
      statusCode: 404,
      message: 'No questions found',
    });
  });

  it('returns questions sorted by createdAt descending', async () => {
    const author = await createUser();

    const first = await Question.create({
      title: 'Older Question',
      description: 'D1',
      author: author._id,
      tags: [],
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = await Question.create({
      title: 'Newer Question',
      description: 'D2',
      author: author._id,
      tags: [],
    });

    const result = await getAllQuestionsService();

    expect(result[0]._id.toString()).toBe(second._id.toString());
    expect(result[1]._id.toString()).toBe(first._id.toString());
  });
});

describe('getQuestionByIdService', () => {
  it('returns question with populated author/tags and attached answers', async () => {
    const author = await createUser({ name: 'Author A' });
    const answerAuthor = await createUser({ name: 'Author B' });
    const tag = await Tag.create({ name: 'express' });

    const question = await Question.create({
      title: 'Q1',
      description: 'D1',
      author: author._id,
      tags: [tag._id],
    });

    await Answer.create({
      questionId: question._id,
      answerText: 'First answer',
      author: answerAuthor._id,
    });

    const result = await getQuestionByIdService(question._id);

    expect(result.author.name).toBe('Author A');
    expect(result.tags).toHaveLength(1);
    expect(result.answers).toHaveLength(1);
    expect(result.answers[0].author.name).toBe('Author B');
  });

  it('increments views when fetching by id', async () => {
    const author = await createUser();
    const question = await Question.create({
      title: 'Q Views',
      description: 'D',
      author: author._id,
      tags: [],
    });

    await getQuestionByIdService(question._id);
    await getQuestionByIdService(question._id);

    const updated = await Question.findById(question._id);
    expect(updated.views).toBe(2);
  });

  it('throws 404 AppError when question is not found', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();

    await expect(getQuestionByIdService(nonExistentId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Question not found',
    });
  });
});

describe('createQuestionService', () => {
  it('creates question and creates missing tags from comma-separated input', async () => {
    const author = await createUser();

    const result = await createQuestionService(
      'Title 1',
      'Description 1',
      'javascript,nodejs',
      author._id
    );

    expect(result.title).toBe('Title 1');
    expect(result.tags).toHaveLength(2);

    const tags = await Tag.find({}).sort({ name: 1 });
    expect(tags.map((t) => t.name)).toEqual(['javascript', 'nodejs']);
  });

  it('reuses existing tags and does not create duplicates', async () => {
    const author = await createUser();
    const existingTag = await Tag.create({ name: 'react' });

    const result = await createQuestionService(
      'Title 2',
      'Description 2',
      'react, react',
      author._id
    );

    expect(result.tags.map((id) => id.toString())).toContain(existingTag._id.toString());

    const tags = await Tag.find({ name: 'react' });
    expect(tags).toHaveLength(1);
  });

  it('accepts tag arrays and trims values', async () => {
    const author = await createUser();

    const result = await createQuestionService(
      'Title 3',
      'Description 3',
      [' express ', 'mongodb', ''],
      author._id
    );

    expect(result.tags).toHaveLength(2);

    const tags = await Tag.find({}).sort({ name: 1 });
    expect(tags.map((t) => t.name)).toEqual(['express', 'mongodb']);
  });
});

describe('updateQuestionService', () => {
  it('allows owner to update title, description, and tags', async () => {
    const owner = await createUser();
    const question = await Question.create({
      title: 'Old title',
      description: 'Old desc',
      author: owner._id,
      tags: [],
    });

    const updated = await updateQuestionService(
      question._id,
      'New title',
      'New desc',
      'api,testing',
      { id: owner._id, isAdmin: false }
    );

    expect(updated.title).toBe('New title');
    expect(updated.description).toBe('New desc');
    expect(updated.tags).toHaveLength(2);
  });

  it('allows admin to update a question they do not own', async () => {
    const owner = await createUser();
    const admin = await createUser({ isAdmin: true });

    const question = await Question.create({
      title: 'Owner title',
      description: 'Owner desc',
      author: owner._id,
      tags: [],
    });

    const updated = await updateQuestionService(
      question._id,
      'Admin updated',
      'Admin desc',
      'security',
      { id: admin._id, isAdmin: true }
    );

    expect(updated.title).toBe('Admin updated');
    expect(updated.tags).toHaveLength(1);
    expect(updated.author.name).toBe(owner.name);
  });

  it('throws 403 AppError when requester is not owner or admin', async () => {
    const owner = await createUser();
    const otherUser = await createUser();

    const question = await Question.create({
      title: 'Locked',
      description: 'Locked desc',
      author: owner._id,
      tags: [],
    });

    await expect(
      updateQuestionService(
        question._id,
        'Hacked title',
        'Hacked desc',
        'hack',
        { id: otherUser._id, isAdmin: false }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'You are not authorized to update this question',
    });
  });

  it('throws 404 AppError when question does not exist', async () => {
    const user = await createUser();

    await expect(
      updateQuestionService(
        new mongoose.Types.ObjectId(),
        'Title',
        'Description',
        'tag',
        { id: user._id, isAdmin: false }
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Question not found',
    });
  });
});

describe('deleteQuestionService', () => {
  it('allows owner to delete question and related answers', async () => {
    const owner = await createUser();

    const question = await Question.create({
      title: 'Delete me',
      description: 'D',
      author: owner._id,
      tags: [],
    });

    await Answer.create({
      questionId: question._id,
      answerText: 'A1',
      author: owner._id,
    });

    const result = await deleteQuestionService(question._id, {
      id: owner._id,
      isAdmin: false,
    });

    const foundQuestion = await Question.findById(question._id);
    const answers = await Answer.find({ questionId: question._id });

    expect(result.success).toBe(true);
    expect(foundQuestion).toBeNull();
    expect(answers).toHaveLength(0);
  });

  it('allows admin to delete question they do not own', async () => {
    const owner = await createUser();
    const admin = await createUser({ isAdmin: true });

    const question = await Question.create({
      title: 'Admin delete',
      description: 'D',
      author: owner._id,
      tags: [],
    });

    const result = await deleteQuestionService(question._id, {
      id: admin._id,
      isAdmin: true,
    });

    expect(result.message).toBe('Question deleted successfully');
    expect(await Question.findById(question._id)).toBeNull();
  });

  it('throws 403 AppError when requester is unauthorized', async () => {
    const owner = await createUser();
    const otherUser = await createUser();

    const question = await Question.create({
      title: 'Protected delete',
      description: 'D',
      author: owner._id,
      tags: [],
    });

    await expect(
      deleteQuestionService(question._id, {
        id: otherUser._id,
        isAdmin: false,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'You are not authorized to delete this question',
    });
  });

  it('throws 404 AppError when question does not exist', async () => {
    const user = await createUser();

    await expect(
      deleteQuestionService(new mongoose.Types.ObjectId(), {
        id: user._id,
        isAdmin: false,
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Question not found',
    });
  });
});

describe('upvoteQuestionService', () => {
  it('adds an upvote and updates voteCount', async () => {
    const author = await createUser();
    const voter = await createUser();

    const question = await Question.create({
      title: 'Upvote Q',
      description: 'D',
      author: author._id,
      tags: [],
    });

    const updated = await upvoteQuestionService(question._id, voter._id);

    expect(updated.upvotes.map(String)).toContain(voter._id.toString());
    expect(updated.voteCount).toBe(1);
  });

  it('switches user downvote to upvote', async () => {
    const author = await createUser();
    const voter = await createUser();

    const question = await Question.create({
      title: 'Switch vote Q',
      description: 'D',
      author: author._id,
      tags: [],
      downvotes: [voter._id],
      voteCount: -1,
    });

    const updated = await upvoteQuestionService(question._id, voter._id);

    expect(updated.downvotes.map(String)).not.toContain(voter._id.toString());
    expect(updated.upvotes.map(String)).toContain(voter._id.toString());
    expect(updated.voteCount).toBe(1);
  });

  it('throws 400 AppError when vote operation returns falsy', async () => {
    vi.spyOn(voteService, 'handleVote').mockResolvedValueOnce(null);

    await expect(
      upvoteQuestionService(new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Failed to upvote question',
    });
  });
});

describe('downvoteQuestionService', () => {
  it('adds a downvote and updates voteCount', async () => {
    const author = await createUser();
    const voter = await createUser();

    const question = await Question.create({
      title: 'Downvote Q',
      description: 'D',
      author: author._id,
      tags: [],
    });

    const updated = await downvoteQuestionService(question._id, voter._id);

    expect(updated.downvotes.map(String)).toContain(voter._id.toString());
    expect(updated.voteCount).toBe(-1);
  });

  it('switches user upvote to downvote', async () => {
    const author = await createUser();
    const voter = await createUser();

    const question = await Question.create({
      title: 'Switch downvote Q',
      description: 'D',
      author: author._id,
      tags: [],
      upvotes: [voter._id],
      voteCount: 1,
    });

    const updated = await downvoteQuestionService(question._id, voter._id);

    expect(updated.upvotes.map(String)).not.toContain(voter._id.toString());
    expect(updated.downvotes.map(String)).toContain(voter._id.toString());
    expect(updated.voteCount).toBe(-1);
  });

  it('throws 400 AppError when vote operation returns falsy', async () => {
    vi.spyOn(voteService, 'handleVote').mockResolvedValueOnce(null);

    await expect(
      downvoteQuestionService(new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Failed to downvote question',
    });
  });
});

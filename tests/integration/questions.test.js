import '../setup.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import User from '../../src/models/User.js';
import Tag from '../../src/models/Tag.js';
import Question from '../../src/models/Question.js';
import Answer from '../../src/models/Answer.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

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

const createAuthHeader = (user) => {
  const token = jwt.sign(
    {
      id: user._id.toString(),
      isAdmin: Boolean(user.isAdmin),
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { Authorization: `Bearer ${token}` };
};

const createQuestion = async (authorId, overrides = {}) => {
  return Question.create({
    title: overrides.title ?? 'Sample Question',
    description: overrides.description ?? 'Sample Description',
    tags: overrides.tags ?? [],
    author: authorId,
    upvotes: overrides.upvotes ?? [],
    downvotes: overrides.downvotes ?? [],
    voteCount: overrides.voteCount ?? 0,
    views: overrides.views ?? 0,
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

describe('Questions API - GET /api/questions', () => {
  it('returns all questions with populated author, tags and answerCount', async () => {
    const author = await createUser({ name: 'Alice' });
    const tag = await Tag.create({ name: 'javascript' });

    const question = await createQuestion(author._id, { tags: [tag._id] });
    await Answer.create({ questionId: question._id, answerText: 'A1', author: author._id });
    await Answer.create({ questionId: question._id, answerText: 'A2', author: author._id });

    const res = await request(app).get('/api/questions');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Questions fetched successfully');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].author.name).toBe('Alice');
    expect(res.body.data[0].tags[0].name).toBe('javascript');
    expect(res.body.data[0].answerCount).toBe(2);
  });

  it('returns 404 when no questions are present', async () => {
    const res = await request(app).get('/api/questions');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No questions found');
  });

  it('returns questions sorted by newest first', async () => {
    const author = await createUser();

    await createQuestion(author._id, { title: 'Older' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await createQuestion(author._id, { title: 'Newer' });

    const res = await request(app).get('/api/questions');

    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe('Newer');
    expect(res.body.data[1].title).toBe('Older');
  });
});

describe('Questions API - GET /api/questions/:id', () => {
  it('returns question details including answers', async () => {
    const author = await createUser({ name: 'Question Owner' });
    const answerAuthor = await createUser({ name: 'Answer Owner' });
    const tag = await Tag.create({ name: 'nodejs' });

    const question = await createQuestion(author._id, { tags: [tag._id] });
    await Answer.create({
      questionId: question._id,
      answerText: 'Helpful answer',
      author: answerAuthor._id,
    });

    const res = await request(app).get(`/api/questions/${question._id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Question fetched successfully');
    expect(res.body.data.author.name).toBe('Question Owner');
    expect(res.body.data.tags[0].name).toBe('nodejs');
    expect(res.body.data.answers).toHaveLength(1);
  });

  it('increments views when question is fetched', async () => {
    const author = await createUser();
    const question = await createQuestion(author._id, { views: 0 });

    await request(app).get(`/api/questions/${question._id}`);
    await request(app).get(`/api/questions/${question._id}`);

    const updated = await Question.findById(question._id);
    expect(updated.views).toBe(2);
  });

  it('returns 404 for a non-existing question id', async () => {
    const res = await request(app).get(`/api/questions/${new Question()._id}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Question not found');
  });
});

describe('Questions API - POST /api/questions', () => {
  it('creates a question when authenticated', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/questions')
      .set(createAuthHeader(user))
      .send({
        title: 'New API Question',
        description: 'Question from API test',
        tags: 'express,mongodb',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Question created successfully');
    expect(res.body.data.title).toBe('New API Question');

    const tags = await Tag.find({}).sort({ name: 1 });
    expect(tags.map((t) => t.name)).toEqual(['express', 'mongodb']);
  });

  it('returns 401 when token is missing', async () => {
    const res = await request(app).post('/api/questions').send({
      title: 'No Auth',
      description: 'Should fail',
      tags: 'test',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No token provided, authorization denied.');
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .post('/api/questions')
      .set({ Authorization: 'Bearer invalid.token.value' })
      .send({
        title: 'Bad Token',
        description: 'Should fail',
        tags: 'test',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Token is not valid.');
  });
});

describe('Questions API - PUT /api/questions/:id', () => {
  it('allows owner to update question', async () => {
    const owner = await createUser();
    const question = await createQuestion(owner._id, {
      title: 'Old title',
      description: 'Old description',
    });

    const res = await request(app)
      .put(`/api/questions/${question._id}`)
      .set(createAuthHeader(owner))
      .send({
        title: 'Updated title',
        description: 'Updated description',
        tags: 'updated,question',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Question updated successfully');
    expect(res.body.data.title).toBe('Updated title');
    expect(res.body.data.tags).toHaveLength(2);
  });

  it('returns 403 when non-owner non-admin tries to update', async () => {
    const owner = await createUser();
    const other = await createUser();
    const question = await createQuestion(owner._id);

    const res = await request(app)
      .put(`/api/questions/${question._id}`)
      .set(createAuthHeader(other))
      .send({
        title: 'Unauthorized update',
        description: 'Should fail',
        tags: 'nope',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('You are not authorized to update this question');
  });

  it('returns 404 when question does not exist', async () => {
    const user = await createUser();

    const res = await request(app)
      .put(`/api/questions/${new Question()._id}`)
      .set(createAuthHeader(user))
      .send({
        title: 'Missing',
        description: 'Missing',
        tags: 'none',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Question not found');
  });
});

describe('Questions API - DELETE /api/questions/:id', () => {
  it('allows owner to delete question and cascades answers delete', async () => {
    const owner = await createUser();
    const question = await createQuestion(owner._id);
    await Answer.create({ questionId: question._id, answerText: 'A1', author: owner._id });

    const res = await request(app)
      .delete(`/api/questions/${question._id}`)
      .set(createAuthHeader(owner));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Question deleted successfully');

    const foundQuestion = await Question.findById(question._id);
    const relatedAnswers = await Answer.find({ questionId: question._id });
    expect(foundQuestion).toBeNull();
    expect(relatedAnswers).toHaveLength(0);
  });

  it('returns 403 when non-owner non-admin tries to delete', async () => {
    const owner = await createUser();
    const other = await createUser();
    const question = await createQuestion(owner._id);

    const res = await request(app)
      .delete(`/api/questions/${question._id}`)
      .set(createAuthHeader(other));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('You are not authorized to delete this question');
  });

  it('returns 404 when question does not exist', async () => {
    const user = await createUser();

    const res = await request(app)
      .delete(`/api/questions/${new Question()._id}`)
      .set(createAuthHeader(user));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Question not found');
  });
});

describe('Questions API - POST /api/questions/:id/upvote', () => {
  it('upvotes a question when authenticated', async () => {
    const owner = await createUser();
    const voter = await createUser();
    const question = await createQuestion(owner._id);

    const res = await request(app)
      .post(`/api/questions/${question._id}/upvote`)
      .set(createAuthHeader(voter));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Question upvoted successfully');
    expect(res.body.data.upvotes.map(String)).toContain(voter._id.toString());
  });

  it('returns 401 when token is missing', async () => {
    const owner = await createUser();
    const question = await createQuestion(owner._id);

    const res = await request(app).post(`/api/questions/${question._id}/upvote`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No token provided, authorization denied.');
  });

  it('returns 401 when token is invalid', async () => {
    const owner = await createUser();
    const question = await createQuestion(owner._id);

    const res = await request(app)
      .post(`/api/questions/${question._id}/upvote`)
      .set({ Authorization: 'Bearer bad.jwt.token' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Token is not valid.');
  });
});

describe('Questions API - POST /api/questions/:id/downvote', () => {
  it('downvotes a question when authenticated', async () => {
    const owner = await createUser();
    const voter = await createUser();
    const question = await createQuestion(owner._id);

    const res = await request(app)
      .post(`/api/questions/${question._id}/downvote`)
      .set(createAuthHeader(voter));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Question downvoted successfully');
    expect(res.body.data.downvotes.map(String)).toContain(voter._id.toString());
  });

  it('returns 401 when token is missing', async () => {
    const owner = await createUser();
    const question = await createQuestion(owner._id);

    const res = await request(app).post(`/api/questions/${question._id}/downvote`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No token provided, authorization denied.');
  });

  it('returns 401 when token is invalid', async () => {
    const owner = await createUser();
    const question = await createQuestion(owner._id);

    const res = await request(app)
      .post(`/api/questions/${question._id}/downvote`)
      .set({ Authorization: 'Bearer bad.jwt.token' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Token is not valid.');
  });
});

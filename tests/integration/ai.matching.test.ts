import {
  api,
  createAndLoginAdmin,
  createAndLoginCandidate,
  createAndLoginEmployer,
  expectErrorShape,
} from '../helpers';
import { createPublishedJob, createTestCategory, createTestLocationTree } from '../helpers/fixtures';
import { Candidate } from '../../src/models/Candidate';
import { User } from '../../src/models/User';
import { hashPassword } from '../../src/utils/password';
import { aiMatchingService } from '../../src/services/aiMatching.service';
import { aiCareerCoachService } from '../../src/services/aiCareerCoach.service';
import { openAiService } from '../../src/services/openai.service';

jest.mock('../../src/services/openai.service', () => ({
  openAiService: {
    isConfigured: jest.fn(() => true),
    getModel: jest.fn(() => 'gpt-4o-mini'),
    chatJson: jest.fn(),
  },
}));

const mockedChatJson = openAiService.chatJson as jest.MockedFunction<
  typeof openAiService.chatJson
>;

async function seedCandidateWithSkills() {
  const passwordHash = await hashPassword('Password1!');
  const user = await User.create({
    name: 'Match Candidate',
    email: `ai.match.${Date.now()}@example.com`,
    phone: `9${String(Date.now()).slice(-9)}`,
    passwordHash,
    role: 'candidate',
    status: 'active',
  });
  const candidateDoc = await Candidate.create({
    userId: user._id,
    headline: 'Node developer',
    skills: ['nodejs', 'typescript', 'Communication'],
    currentJobTitle: 'Backend Engineer',
    totalExperience: 3,
    expectedSalary: 800000,
    currentLocation: 'Mumbai',
    openToWork: true,
    noticePeriod: 30,
  });
  return {
    user,
    candidateDoc,
    auth: {
      userId: user._id.toString(),
      candidateId: candidateDoc._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: 'candidate' as const,
      status: 'active' as const,
    },
  };
}

describe('AI matching & career coach', () => {
  beforeEach(() => {
    mockedChatJson.mockReset();
  });

  it('returns 404 when AI matching is disabled in test env', async () => {
    const candidate = await createAndLoginCandidate();
    await expectErrorShape(
      await api().get('/api/v1/candidate/ai/matches').set(candidate.header),
      404,
    );
  });

  it('returns 404 when AI career coach is disabled in test env', async () => {
    const candidate = await createAndLoginCandidate();
    await expectErrorShape(
      await api().get('/api/v1/candidate/ai/career-coach').set(candidate.header),
      404,
    );
  });

  it('lists matches with percentage, skills, and recommended jobs (102–106, 108)', async () => {
    const { auth } = await seedCandidateWithSkills();
    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();
    const category = await createTestCategory(admin);
    const { cityId } = await createTestLocationTree(admin);
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Node.js Engineer',
    });

    mockedChatJson.mockResolvedValue({
      content: JSON.stringify({
        insights: [{ jobId, blurb: 'Strong Node and TypeScript overlap.' }],
      }),
      model: 'gpt-4o-mini',
    });

    const result = await aiMatchingService.listMatches(auth, {
      limit: 10,
      minScore: 20,
      withAiInsights: true,
    });

    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0];
    expect(top.matchPercentage).toBeGreaterThan(0);
    expect(Array.isArray(top.matchingSkills)).toBe(true);
    expect(Array.isArray(top.missingSkills)).toBe(true);
    expect(typeof top.experienceMatch).toBe('number');
    expect(typeof top.salaryMatch).toBe('number');
    expect(typeof top.locationMatch).toBe('number');
    expect(typeof top.availabilityMatch).toBe('number');
    expect(result.recommendedJobs.length).toBeGreaterThan(0);
    expect(result.aiGenerated).toBe(true);
    expect(result.aiLabel).toBe('AI-generated');
    expect(result.uiHint.showAiBadge).toBe(true);
  });

  it('explains why a job matches and labels AI content (107)', async () => {
    const { auth } = await seedCandidateWithSkills();
    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();
    const category = await createTestCategory(admin);
    const { cityId } = await createTestLocationTree(admin);
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Node.js Engineer',
    });

    mockedChatJson.mockResolvedValue({
      content: JSON.stringify({
        summary: 'Good fit on Node skills.',
        whyItMatches: ['TypeScript experience'],
        gapsToImprove: ['Add cloud basics'],
        nextSteps: ['Tailor resume'],
      }),
      model: 'gpt-4o-mini',
    });

    const result = await aiMatchingService.explainMatch(auth, jobId);
    expect(result.aiGenerated).toBe(true);
    expect(result.aiLabel).toBe('AI-generated');
    expect(result.explanation.summary).toContain('fit');
    expect(result.match.matchPercentage).toBeGreaterThanOrEqual(0);
  });

  it('returns career coach pack with salary + missing skills (109–112)', async () => {
    const { auth } = await seedCandidateWithSkills();
    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();
    const category = await createTestCategory(admin);
    const { cityId } = await createTestLocationTree(admin);
    await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Senior Node Engineer',
    });

    mockedChatJson.mockResolvedValue({
      content: JSON.stringify({
        coachSummary: 'Focus on senior backend roles next.',
        careerRecommendations: [{ title: 'Backend Lead', why: 'Skill path', priority: 'high' }],
        jobRecommendations: [{ title: 'Node Engineer', why: 'Skill fit', targetMatchHint: '70%+' }],
        salaryGuidance: {
          suggestedMin: 700000,
          suggestedMax: 1100000,
          currency: 'INR',
          period: 'yearly',
          rationale: 'Based on similar roles',
          negotiationTips: ['Highlight TypeScript projects'],
        },
        missingSkillSuggestions: [
          { skill: 'AWS', why: 'Common in backend roles', howToLearn: 'Short course' },
        ],
        actionPlan: ['Update skills on profile'],
      }),
      model: 'gpt-4o-mini',
    });

    const result = await aiCareerCoachService.getCoach(auth);
    expect(result.aiGenerated).toBe(true);
    expect(result.aiLabel).toBe('AI-generated');
    expect(result.careerRecommendations.length).toBeGreaterThan(0);
    expect(result.jobRecommendations.length).toBeGreaterThan(0);
    expect(result.salaryGuidance.suggestedMin).toBe(700000);
    expect(result.missingSkillSuggestions.length).toBeGreaterThan(0);
    expect(result.uiHint.badgeText).toBe('AI-generated');
  });
});

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
import { aiResumeService } from '../../src/services/aiResume.service';
import { openAiService } from '../../src/services/openai.service';

jest.mock('../../src/services/openai.service', () => ({
  openAiService: {
    isConfigured: jest.fn(() => true),
    getModel: jest.fn(() => 'gpt-4o-mini'),
    chatJson: jest.fn(),
  },
}));

const mockAiJson = {
  resume: {
    headline: 'Customer Support Specialist',
    summary: 'Reliable support professional with strong communication skills.',
    skills: ['Communication', 'CRM'],
    experience: [
      {
        title: 'Support Associate',
        company: 'Demo Co',
        bullets: ['Resolved tickets within SLA'],
      },
    ],
    education: [
      {
        degree: 'B.Com',
        institution: 'Mumbai University',
        highlight: 'First class',
      },
    ],
    certifications: [],
    plainText: 'Customer Support Specialist\n\nReliable support professional.',
  },
  tips: ['Quantify your ticket volume if possible'],
};

const mockedChatJson = openAiService.chatJson as jest.MockedFunction<
  typeof openAiService.chatJson
>;

describe('AI resume builder & tailoring', () => {
  beforeEach(() => {
    mockedChatJson.mockReset();
    mockedChatJson.mockResolvedValue({
      content: JSON.stringify(mockAiJson),
      model: 'gpt-4o-mini',
    });
  });

  it('returns 404 when AI resume feature is disabled in test env', async () => {
    const candidate = await createAndLoginCandidate();
    await expectErrorShape(
      await api()
        .post('/api/v1/candidate/profile/resume/ai/build')
        .set(candidate.header)
        .send({ tone: 'professional' }),
      404,
    );
  });

  it('builds a resume draft and always labels it as AI-generated', async () => {
    const passwordHash = await hashPassword('Password1!');
    const user = await User.create({
      name: 'AI Candidate',
      email: `ai.resume.${Date.now()}@example.com`,
      phone: `9${String(Date.now()).slice(-9)}`,
      passwordHash,
      role: 'candidate',
      status: 'active',
    });
    const candidateDoc = await Candidate.create({
      userId: user._id,
      headline: 'Support pro',
      skills: ['CRM'],
      currentJobTitle: 'Support Associate',
      currentCompany: 'Demo Co',
    });

    const result = await aiResumeService.build(
      {
        userId: user._id.toString(),
        candidateId: candidateDoc._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'candidate',
        status: 'active',
      },
      { tone: 'professional', focusRoles: [] },
    );

    expect(result.aiGenerated).toBe(true);
    expect(result.aiLabel).toBe('AI-generated');
    expect(result.aiDisclaimer.toLowerCase()).toContain('chatgpt');
    expect(result.uiHint.showAiBadge).toBe(true);
    expect(result.uiHint.badgeText).toBe('AI-generated');
    expect(result.uiHint.bannerText.toLowerCase()).toContain('ai-generated');
    expect(result.purpose).toBe('resume_builder');
    expect(result.job).toBeNull();
    expect(result.resume.headline).toBe('Customer Support Specialist');
    expect(result.provider).toBe('openai');
    expect(mockedChatJson).toHaveBeenCalled();
  });

  it('tailors a resume for a job and keeps AI provenance fields', async () => {
    const passwordHash = await hashPassword('Password1!');
    const user = await User.create({
      name: 'AI Tailor',
      email: `ai.tailor.${Date.now()}@example.com`,
      phone: `8${String(Date.now()).slice(-9)}`,
      passwordHash,
      role: 'candidate',
      status: 'active',
    });
    const candidateDoc = await Candidate.create({
      userId: user._id,
      headline: 'Node developer',
      skills: ['nodejs'],
    });

    const admin = await createAndLoginAdmin();
    const employer = await createAndLoginEmployer();
    const category = await createTestCategory(admin);
    const { cityId } = await createTestLocationTree(admin);
    const { jobId } = await createPublishedJob(employer, {
      categoryId: category.id,
      locationId: cityId,
      title: 'Node.js Engineer',
    });

    const result = await aiResumeService.tailor(
      {
        userId: user._id.toString(),
        candidateId: candidateDoc._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'candidate',
        status: 'active',
      },
      { jobId, tone: 'professional' },
    );

    expect(result.aiGenerated).toBe(true);
    expect(result.purpose).toBe('job_tailoring');
    expect(result.job?.id).toBe(jobId);
    expect(result.job?.title).toContain('Node');
    expect(result.uiHint.bannerText.toLowerCase()).toContain('ai-tailored');
    expect(result.aiDisclaimer.toLowerCase()).toContain('review');
  });
});

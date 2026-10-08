/**
 * Every ChatGPT feature the product can spend money on.
 * Admin toggles these at runtime. Web and mobile read the same flags from /me.
 */
export const AI_FEATURE_CATALOG = [
  {
    key: 'aiResumeEnabled',
    settingKey: 'ai.resume.enabled',
    label: 'AI resume builder',
    description: 'Candidate AI resume builder and job-specific resume tailoring.',
    audience: 'candidate',
    envKey: 'enableAiResume',
  },
  {
    key: 'aiMatchingEnabled',
    settingKey: 'ai.matching.enabled',
    label: 'Candidate job matching',
    description: 'Candidate-side AI match list and explain-why for jobs.',
    audience: 'candidate',
    envKey: 'enableAiMatching',
  },
  {
    key: 'aiEmployerMatchingEnabled',
    settingKey: 'ai.employerMatching.enabled',
    label: 'Employer candidate matching',
    description: 'Employer-side AI insights and explain-why when ranking candidates for a job.',
    audience: 'employer',
    envKey: 'enableAiMatching',
  },
  {
    key: 'aiCareerCoachEnabled',
    settingKey: 'ai.careerCoach.enabled',
    label: 'AI career coach',
    description: 'Candidate career coach (recommendations, salary, and skills).',
    audience: 'candidate',
    envKey: 'enableAiCareerCoach',
  },
  {
    key: 'aiRecruitmentEnabled',
    settingKey: 'ai.recruitment.enabled',
    label: 'Employer AI assistant',
    description: 'Master switch for employer AI recruitment tools. Off hides every tool below.',
    audience: 'employer',
    envKey: 'enableAiRecruitment',
  },
  {
    key: 'aiJdImproveEnabled',
    settingKey: 'ai.jdImprove.enabled',
    label: 'AI job description',
    description: 'Rewrite a job description with AI.',
    audience: 'employer',
    envKey: 'enableAiRecruitment',
    masterSettingKey: 'ai.recruitment.enabled',
  },
  {
    key: 'aiSkillSuggestEnabled',
    settingKey: 'ai.skillSuggest.enabled',
    label: 'AI skill suggestions',
    description: 'Suggest skills for a job post.',
    audience: 'employer',
    envKey: 'enableAiRecruitment',
    masterSettingKey: 'ai.recruitment.enabled',
  },
  {
    key: 'aiCandidateScreenEnabled',
    settingKey: 'ai.candidateScreen.enabled',
    label: 'AI candidate screening',
    description: 'Screen applicants against a job with AI.',
    audience: 'employer',
    envKey: 'enableAiRecruitment',
    masterSettingKey: 'ai.recruitment.enabled',
  },
  {
    key: 'aiProfileSummaryEnabled',
    settingKey: 'ai.profileSummary.enabled',
    label: 'AI profile summary',
    description: 'Summarize a candidate profile with AI.',
    audience: 'employer',
    envKey: 'enableAiRecruitment',
    masterSettingKey: 'ai.recruitment.enabled',
  },
  {
    key: 'aiCandidateSuggestEnabled',
    settingKey: 'ai.candidateSuggest.enabled',
    label: 'AI candidate suggestions',
    description: 'Suggest candidates for a job with AI.',
    audience: 'employer',
    envKey: 'enableAiRecruitment',
    masterSettingKey: 'ai.recruitment.enabled',
  },
  {
    key: 'aiInterviewQuestionsEnabled',
    settingKey: 'ai.interviewQuestions.enabled',
    label: 'AI interview questions',
    description: 'Generate and store AI interview questions for a job.',
    audience: 'employer',
    envKey: 'enableAiRecruitment',
    masterSettingKey: 'ai.recruitment.enabled',
  },
  {
    key: 'aiSelectionMessageEnabled',
    settingKey: 'ai.selectionMessage.enabled',
    label: 'AI selection message',
    description: 'Draft a selection message with AI.',
    audience: 'employer',
    envKey: 'enableAiRecruitment',
    masterSettingKey: 'ai.recruitment.enabled',
  },
  {
    key: 'aiRejectionMessageEnabled',
    settingKey: 'ai.rejectionMessage.enabled',
    label: 'AI rejection message',
    description: 'Draft a rejection message with AI.',
    audience: 'employer',
    envKey: 'enableAiRecruitment',
    masterSettingKey: 'ai.recruitment.enabled',
  },
] as const;

export type AiFeatureKey = (typeof AI_FEATURE_CATALOG)[number]['key'];
export type AiFeatureEnvKey = (typeof AI_FEATURE_CATALOG)[number]['envKey'];

export function aiFeatureByKey(key: string) {
  return AI_FEATURE_CATALOG.find((item) => item.key === key);
}

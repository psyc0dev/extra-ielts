import { z } from 'zod'

export const RoleSchema = z.enum(['admin', 'student'])
export const AssignmentTypeSchema = z.enum(['task', 'homework'])
export const SectionKindSchema = z.enum(['listening', 'reading'])
export const AttemptStatusSchema = z.enum(['in-progress', 'completed'])
export const QuestionTypeSchema = z.enum([
  'mcq',
  'short',
  'true-false-notgiven',
  'yes-no-notgiven',
  'match-headings',
  'matching',
  'sentence-completion',
  'note-completion',
  'table-completion',
  'diagram-labelling',
  'form-completion',
  'flowchart-completion',
  'map-labelling',
  'multiple-choice-multiple',
  'summary-completion',
  'matching-paragraph-information',
  'matching-features',
  'matching-sentence-endings',
  'choose-title',
])

export const UserSettingsSchema = z.object({
  notifications: z.boolean(),
  sound: z.boolean(),
  timerWarning: z.boolean(),
})

export const ApiUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  role: RoleSchema,
  avatarUrl: z.string().nullable().optional(),
})

// Request body schemas
export const LoginBodySchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

export const RegisterBodySchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email().optional(),
  password: z.string().min(6),
})

export const BootstrapBodySchema = z.object({
  username: z.string().min(1),
  email: z.string().email().optional(),
  password: z.string().min(1),
})

export const CreateUserBodySchema = z.object({
  username: z.string().min(1),
  email: z.string().email().optional(),
  password: z.string().min(6),
  role: RoleSchema,
})

export const CreateAssignmentBodySchema = z.object({
  type: AssignmentTypeSchema,
  testId: z.string().min(1),
  sectionKinds: z.array(SectionKindSchema).optional(),
  assignedTo: z.string().min(1),
  dueAt: z.string().nullable().optional(),
})

export const GroupAssignmentBodySchema = z.object({
  type: AssignmentTypeSchema,
  testId: z.string().min(1),
  sectionKinds: z.array(SectionKindSchema).optional(),
  dueAt: z.string().nullable().optional(),
})

export const GroupNameBodySchema = z.object({
  name: z.string().min(1),
})

export const GroupMemberBodySchema = z.object({
  userId: z.string().min(1),
})

export const AnswerBodySchema = z.object({
  questionId: z.string().min(1).max(100),
  response: z.union([z.string().max(500), z.array(z.string().max(200)).max(20), z.null()]).optional(),
})

export const SubmitAttemptBodySchema = z.object({
  status: z.literal('completed'),
})

export const PasswordResetRequestBodySchema = z.object({
  email: z.string().email(),
})

export const PasswordResetBodySchema = z.object({
  otp: z.string().length(6),
  password: z.string().min(6),
})

const MAX_AVATAR_SIZE_MB = 1;
const MAX_BASE64_LENGTH = Math.ceil(MAX_AVATAR_SIZE_MB * 1024 * 1024 * 4 / 3) + 100; // ~1.33MB + header overhead

export const AvatarBodySchema = z.object({
  dataUrl: z.string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Invalid image format. Only PNG, JPEG, and WebP are allowed.')
    .refine(
      (s) => s.length <= MAX_BASE64_LENGTH,
      `Image too large. Maximum size is ${MAX_AVATAR_SIZE_MB}MB.`
    ),
})

export const WritingEvaluationBodySchema = z.object({
  topic: z.string().min(1),
  essay: z.string().min(1),
})

export const SettingsPatchBodySchema = z.object({
  notifications: z.boolean().optional(),
  sound: z.boolean().optional(),
  timerWarning: z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, { message: 'No valid settings provided.' })

export const TestPublishedBodySchema = z.object({
  published: z.boolean(),
})

// Inferred types
export type Role = z.infer<typeof RoleSchema>
export type AssignmentType = z.infer<typeof AssignmentTypeSchema>
export type SectionKind = z.infer<typeof SectionKindSchema>
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>
export type QuestionType = z.infer<typeof QuestionTypeSchema>
export type UserSettings = z.infer<typeof UserSettingsSchema>
export type ApiUser = z.infer<typeof ApiUserSchema>

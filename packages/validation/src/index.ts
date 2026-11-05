import { z } from 'zod';
import { USERNAME_MIN, USERNAME_MAX, USERNAME_RESERVED } from '@cinecraft/core';

/** Same rule as the app and the database guard (part AG): 3-20 chars, lower-case letters, digits, underscore, not reserved. */
export const usernameSchema = z
  .string()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`)
  .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
  .refine((v) => !USERNAME_RESERVED.includes(v), 'That username is reserved. Please choose another');

/** A media link may only be a web address (http/https, which includes our storage URLs); never javascript:, data: and the like. */
export const mediaUrlSchema = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), 'Media links must start with http:// or https://');

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  username: usernameSchema,
  craft: z.string().optional(),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  username: usernameSchema.optional(),
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
  craft: z.string().optional(),
  experience: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url('Invalid URL').or(z.literal('')).optional(),
});

export const messageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1, 'Message cannot be empty'),
  recipientId: z.string().uuid().optional(),
});

export const postCreateSchema = z
  .object({
    // A post may be media-only or poll-only (see checkPost in @cinecraft/core), so the caption can be empty.
    content: z.string().max(2200, 'Your caption is too long (limit 2200)').default(''),
    mediaUrls: z.array(mediaUrlSchema).max(10, 'You can add up to 10 photos or videos.').optional(),
    tags: z.array(z.string()).optional(),
    hasPoll: z.boolean().optional(),
    hasAiGenerated: z.boolean().default(false),
  })
  .refine((v) => v.content.trim().length > 0 || (v.mediaUrls?.length ?? 0) > 0 || !!v.hasPoll, {
    message: 'Write a caption, add a photo or video, or add a poll first.',
    path: ['content'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type PostCreateInput = z.infer<typeof postCreateSchema>;

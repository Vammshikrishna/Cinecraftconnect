import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  craft: z.string().optional(),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores').optional(),
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

export const postCreateSchema = z.object({
  content: z.string().min(1, 'Post content cannot be empty'),
  mediaUrls: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  hasAiGenerated: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type PostCreateInput = z.infer<typeof postCreateSchema>;

-- Add indexes for unindexed foreign keys to improve performance

-- announcements
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON public.announcements(author_id);

-- budget_items
CREATE INDEX IF NOT EXISTS idx_budget_items_project_id ON public.budget_items(project_id);

-- call_reactions
CREATE INDEX IF NOT EXISTS idx_call_reactions_user_id ON public.call_reactions(user_id);

-- call_sheets
CREATE INDEX IF NOT EXISTS idx_call_sheets_project_id ON public.call_sheets(project_id);

-- calls
CREATE INDEX IF NOT EXISTS idx_calls_started_by ON public.calls(started_by);

-- comments
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);

-- conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user2_id ON public.conversations(user2_id);

-- direct_messages
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON public.direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON public.direct_messages(sender_id);

-- discussion_rooms
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_category_id ON public.discussion_rooms(category_id);
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_creator_id ON public.discussion_rooms(creator_id);
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_project_id ON public.discussion_rooms(project_id);

-- files
CREATE INDEX IF NOT EXISTS idx_files_project_id ON public.files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON public.files(uploaded_by);

-- job_applications
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_id ON public.job_applications(applicant_id);

-- jobs
CREATE INDEX IF NOT EXISTS idx_jobs_posted_by ON public.jobs(posted_by);

-- legal_docs
CREATE INDEX IF NOT EXISTS idx_legal_docs_project_id ON public.legal_docs(project_id);
CREATE INDEX IF NOT EXISTS idx_legal_docs_uploaded_by ON public.legal_docs(uploaded_by);

-- likes
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);

-- message_reactions
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_trigger_user_id ON public.notifications(trigger_user_id);

-- portfolio_items
CREATE INDEX IF NOT EXISTS idx_portfolio_items_user_id ON public.portfolio_items(user_id);

-- post_comments
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);

-- post_likes
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

-- posts
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);

-- project_applications
CREATE INDEX IF NOT EXISTS idx_project_applications_user_id ON public.project_applications(user_id);

-- project_invites
CREATE INDEX IF NOT EXISTS idx_project_invites_created_by ON public.project_invites(created_by);
CREATE INDEX IF NOT EXISTS idx_project_invites_project_id ON public.project_invites(project_id);

-- project_members
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);

-- project_message_read_status
CREATE INDEX IF NOT EXISTS idx_project_message_read_status_user_id ON public.project_message_read_status(user_id);

-- project_messages
CREATE INDEX IF NOT EXISTS idx_project_messages_user_id ON public.project_messages(user_id);

-- project_space_join_requests
CREATE INDEX IF NOT EXISTS idx_project_space_join_requests_user_id ON public.project_space_join_requests(user_id);

-- project_space_members
CREATE INDEX IF NOT EXISTS idx_project_space_members_user_id ON public.project_space_members(user_id);

-- project_space_message_read_status
CREATE INDEX IF NOT EXISTS idx_project_space_message_read_status_user_id ON public.project_space_message_read_status(user_id);

-- project_space_messages
CREATE INDEX IF NOT EXISTS idx_project_space_messages_project_space_id ON public.project_space_messages(project_space_id);
CREATE INDEX IF NOT EXISTS idx_project_space_messages_user_id ON public.project_space_messages(user_id);

-- project_spaces
CREATE INDEX IF NOT EXISTS idx_project_spaces_category_id ON public.project_spaces(category_id);
CREATE INDEX IF NOT EXISTS idx_project_spaces_creator_id ON public.project_spaces(creator_id);

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_creator_id ON public.projects(creator_id);

-- review_helpful_marks
CREATE INDEX IF NOT EXISTS idx_review_helpful_marks_user_id ON public.review_helpful_marks(user_id);

-- room_join_requests
CREATE INDEX IF NOT EXISTS idx_room_join_requests_room_id ON public.room_join_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_room_join_requests_user_id ON public.room_join_requests(user_id);

-- room_keys
CREATE INDEX IF NOT EXISTS idx_room_keys_sender_id ON public.room_keys(sender_id);
CREATE INDEX IF NOT EXISTS idx_room_keys_user_id ON public.room_keys(user_id);

-- room_members
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);

-- room_messages
CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON public.room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_user_id ON public.room_messages(user_id);

-- schedule_items
CREATE INDEX IF NOT EXISTS idx_schedule_items_assigned_to ON public.schedule_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_schedule_items_project_id ON public.schedule_items(project_id);

-- shares
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON public.shares(user_id);

-- shot_list
CREATE INDEX IF NOT EXISTS idx_shot_list_project_id ON public.shot_list(project_id);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_space_id ON public.tasks(project_space_id);

-- user_activities
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);

-- user_analytics
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON public.user_analytics(user_id);

-- user_connections
CREATE INDEX IF NOT EXISTS idx_user_connections_follower_id ON public.user_connections(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_following_id ON public.user_connections(following_id);

-- user_experience
CREATE INDEX IF NOT EXISTS idx_user_experience_user_id ON public.user_experience(user_id);

-- user_skills
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON public.user_skills(user_id);

# SQL run order

All the manual database files live in `supabase/manual/`. You run each one by pasting it into the Supabase Dashboard under SQL Editor.

This page lists every `part_*.sql` file in the order to run it. For a project that is already set up, you only need the parts you have not run yet. Find the last part you ran and continue from the next row.

## How to read this page

- **Order** is the part letters: a to z, then aa to az, ba to bz, and so on up to gi. Parts with a number (gi_1, gi_5) run in number order.
- **Safe to re-run** (marked `yes`) means the file says it can run more than once. Marked `check` means the file header does not say so. Read the header first and run it once only.
- **Special step** marks files that need something before or alongside the SQL.
- Every file has a PREFLIGHT query (read only, run before) and a POST-CHECK query (read only, run after) in its header. Run them. They tell you in one line whether the part is already applied or worked.
- The apps keep working before the newest parts are applied. Each new web feature shows a short note instead of failing. So you can run the SQL before or after the web build. The recommended order is SQL, then functions, then web (see [DEPLOY.md](DEPLOY.md)).
- Which parts are already applied on the live project: TO CONFIRM. The test results say parts up to `part_gg` were applied for the admin round and `part_gi_1` to `part_gi_6` for the owner-team round. Check with the PREFLIGHT lines.

## Special rules that matter

1. **Part B, C, E, F, G** (the first phase) have order rules. Part B only after the new builds and the delete-account and push-delivery functions are deployed. Part C only after the new web build (signed links) is live. Part E together with the new web and mobile builds. Part F after the new apps. Part G LAST of that group, only when the new apps are live and checked, because it drops old columns.
2. **part_gc_finance_role** adds a new value to an enum. If the SQL editor says the new value "finance" cannot be used in the same batch, run only the first statement (the `ALTER TYPE ... ADD VALUE`) on its own, then run the rest. It should run after part_ca, part_ct and part_gd (part_gd is only needed for the two-step flag; the file works without it).
3. **part_ga before part_gh_mod_duplicates.** The duplicates part replaces a function from part_ga.
4. **part_gi_1 before part_gi_5.** The digest numbers use the team numbers. part_gi_5 before part_gi_6 and part_gi_7.
5. **part_gi_6_schedule** needs extras first. See the Special step column and the steps below the table.
6. **part_fl_remove_test_accounts is LAST** and only when all testing is finished. It deletes the automated test accounts and everything they made.
7. **part_cl_rollback** is not part of the order. Run it only if part_cl caused a problem.
8. **part_gd** replaces `staff_set_security_settings` from part_bu. Run it after part_bu and part_bi.
9. **part_ee** runs after part_cl and part_cw.
10. **part_fm_*** runs after part_fh_*. Run the three part_fm files in this order: room_policies_rebuild, room_public_visibility, invite_policy_fix.
11. **part_fo_*** files: run fo, then fo_v2, then fo2 (each fixes what the earlier one missed). The two pitch files are fj_pitch_duplicate_notification, then fo_pitch_duplicate_notification_v2.
12. **part_ek to part_et** are security clean-ups. Part_en opens something that part_er closes again, so run part_er soon after part_en. Run part_es and part_et after part_er.
13. Letters missing from the list (for example bc, be, du, dw, dx, dy, eb, ed, fi, fu, fv) do not exist. That is normal.

## The list

### Phase 1: first parts (A to Z)

| # | File | What it adds | Safe to re-run | Special step |
|---|---|---|---|---|
| 1 | part_a_safe_now | First safe migrations (0, 1, 3) | yes | |
| 2 | part_b_move_private_profile_columns | Moves private profile columns to a private table | check | Only after new builds and delete-account, push-delivery functions are deployed |
| 3 | part_c_private_buckets | Makes storage buckets private | check | Only after the new web build (signed URLs) is live |
| 4 | part_d_settings_and_dm_privacy | Settings columns, DM privacy and block triggers | yes | |
| 5 | part_e_private_presence | Presence channel becomes private | check | Run together with the new web and mobile builds |
| 6 | part_f_profile_extras | Profile extras, phase 1: create and copy, drops nothing | check | After the new apps are deployed |
| 7 | part_g_drop_moved_profile_columns | Drops the old public profile columns | check | LAST of phase 1, only when new apps are live and checked |
| 8 | part_h_export_my_data | export_my_data() function | yes | |
| 9 | part_i_moderation_actions | moderator_resolve_report() | yes | |
| 10 | part_j_two_person_approval | Two-person approval queue (replaces part I function) | yes | |
| 11 | part_k_pitch_access_log_actions | Pitch access log records PDF downloads | yes | |
| 12 | part_l_performance_indexes | Read-path indexes | yes | |
| 13 | part_m_answer_call_live_calls | Join a running group call late | yes | |
| 14 | part_n_audio_spaces | Audio spaces | yes | After part_m. Then deploy functions livekit-token and space-control |
| 15 | part_o_call_membership | Fixes "not an authorized member" on calls | yes | |
| 16 | part_p_jobs_hiring | Jobs and hiring overhaul | yes | |
| 17 | part_q_marketplace_security | Marketplace and vendor security | yes | After P |
| 18 | part_r_marketplace_bookings_quotes | Bookings, quotes, vendor verification | yes | After Q. Creates private vendor_docs bucket |
| 19 | part_s_service_alerts | Alerts for vendor services | yes | After R |
| 20 | part_t_company_pages_fixes | Company page security and bug fixes | yes | After Q |
| 21 | part_u_company_page_team | Company page team and followers | yes | After T |
| 22 | part_v_company_page_growth | Page verification, insights, showcase, transfer | yes | After U. Creates private page_docs bucket |
| 23 | part_w_company_page_privacy | Company page privacy | yes | After V |
| 24 | part_x_announcements | Announcements fixes and features | yes | After W |
| 25 | part_y_announcements_more | Announcement edit history and platform broadcasts | yes | After X |
| 26 | part_z_announcements_remove_reactions | Removes announcement reactions and comments | yes | After Y |

### Phase 2: ratings, network, profile, posts, feed (AA to BN)

| # | File | What it adds | Safe to re-run | Special step |
|---|---|---|---|---|
| 27 | part_aa_ratings_security | Ratings and reviews security | check | |
| 28 | part_ab_ratings_features | Watchlist, review filters, My Ratings | check | After AA |
| 29 | part_ac_ratings_new | Weighted score, creator replies, trending, lists | check | After AB |
| 30 | part_ad_network_security | Connection request rules and bug fixes | check | |
| 31 | part_ae_network_features | Who can send requests, notes, ignore | check | After AD |
| 32 | part_af_network_new | Private notes and tags, availability, introductions | check | After AE |
| 33 | part_ag_lock_moderation_columns | Locks moderation columns | check | |
| 34 | part_ag_profile_security | Profile security and bugs | check | |
| 35 | part_ah_profile_features | Completeness, highlights, awards | check | After AG |
| 36 | part_ai_profile_new | Endorsements, Discover filters | check | After AH |
| 37 | part_aj_public_profile | Real counts, profile access state | check | |
| 38 | part_ak_public_profile_features | How you are connected, activity strip | check | After AJ |
| 39 | part_al_profile_collaboration | Date requests, project invitations | check | |
| 40 | part_am_help_center | Help Center tickets and replies | check | |
| 41 | part_an_e2ee_opt_in | Encrypted messages become opt-in | check | |
| 42 | part_ao_search_indexes | Search speed-up (trigram indexes) | yes | Optional |
| 43 | part_ap_saved_searches | Saved searches | check | |
| 44 | part_aq_posts | Posts | check | |
| 45 | part_ar_post_audience | Post audience | check | |
| 46 | part_as_post_polls | Post polls | check | |
| 47 | part_at_post_extras | Post extras | yes | |
| 48 | part_au_post_collaborators | Post collaborators | check | |
| 49 | part_av_pitch_security | Pitch and Story Exchange security | check | After AU |
| 50 | part_aw_pitch_features | Withdraw, notes, feedback, call stats | check | |
| 51 | part_ax_pitch_extras | Pitch file attachments, reports, NDA record | check | Creates a private bucket |
| 52 | part_ay_feed_fixes | One ranking function for the feed | check | |
| 53 | part_az_feed_features | Not interested, mute author, insights | check | |
| 54 | part_ba_feed_personalization | Interests and "why am I seeing this" | check | |
| 55 | part_bb_feed_media_urls | Feed returns media_urls | check | |
| 56 | part_bd_work_requests_need_connection | Date requests and invites need a connection | check | |
| 57 | part_bf_comment_fixes | Comment fixes | yes | |
| 58 | part_bg_comment_features | Comment features | yes | |
| 59 | part_bh_room_member_counts | Live room member counts | yes | |
| 60 | part_bi_governance_actions | Governance actions run on the server | yes | |
| 61 | part_bj_governance_features | Governance features | yes | |
| 62 | part_bk_audit_log_lock | Audit log is write-once, database only | yes | |
| 63 | part_bl_governance_queue | Better moderation queue | yes | |
| 64 | part_bm_governance_assist | Governance made easier | yes | |
| 65 | part_bn_login_rate_limit | Sign-in rate limit | check | |

### Phase 3: staff rules, billing, safety (BO to CI)

| # | File | What it adds | Safe to re-run | Special step |
|---|---|---|---|---|
| 66 | part_bo_settings_language | Language column | check | |
| 67 | part_bp_staff_observer_access | Audited, read-only staff visits to private rooms | yes | |
| 68 | part_bq_staff_never_members | Staff can never be room or project members | yes | |
| 69 | part_br_staff_see_nothing_without_grant | Staff see nothing private without a grant | yes | |
| 70 | part_bs_staff_no_chat_notifications | Staff get no chat notifications | yes | |
| 71 | part_bt_staff_no_social_features | Staff cannot take part in social features | yes | |
| 72 | part_bu_admin_console_gaps | Admin console gaps, staff two-step settings | yes | |
| 73 | part_bv_billing_foundation | Billing foundation | yes | |
| 74 | part_bw_gifts | Gifts | yes | |
| 75 | part_bx_paid_products | Paid products | check | |
| 76 | part_by_payments_overview | Payments overview | check | |
| 77 | part_bz_verification_payment_info | Verification payment info | check | |
| 78 | part_ca_refunds_disputes_payouts | Refunds, disputes, payouts | check | |
| 79 | part_cb_my_payments_and_schedule | My payments and schedule | yes | |
| 80 | part_cc_safety_core | Safety core | yes | |
| 81 | part_cd_staff_behaviour_alerts | Staff behaviour alerts | yes | |
| 82 | part_ce_safety_analytics_transparency | Safety analytics and transparency | yes | |
| 83 | part_cf_marketplace_dispute_centre | Marketplace dispute centre | yes | |
| 84 | part_cg_auto_detection | Automatic detection | yes | |
| 85 | part_ch_workload_and_second_review | Workload and second review | yes | |
| 86 | part_ci_message_fast_lane | Fast lane for urgent messages | yes | |

### Phase 4: security audit (CJ to FD)

| # | File | What it adds | Safe to re-run | Special step |
|---|---|---|---|---|
| 87 | part_cj_close_open_legacy_functions | Closes open legacy functions | check | |
| 88 | part_ck_close_open_policies | Closes open policies | check | |
| 89 | part_cl_calls_membership_notifications | Calls, project membership, notifications | check | part_cl_rollback undoes it (not in the order) |
| 90 | part_cm_push_secret_and_removed_users | Push webhook secret, removed audio-space users | check | Needs the push secret set |
| 91 | part_cn_storage_owner_lookup | Find uploaded files by owner | check | |
| 92 | part_co_account_deletion_foreign_keys | Lets accounts be deleted | check | |
| 93 | part_cp_posts_comments_profiles | Post counters, comment privacy | check | |
| 94 | part_cq_close_info_leaks | Stops "ask about any user" leaks | check | |
| 95 | part_cr_group_keys_no_overwrite | Group chat keys cannot be overwritten | check | |
| 96 | part_cs_key_vault | Key vault for encrypted-chat PIN backup | check | Deploy the key-vault function |
| 97 | part_ct_billing_safety | Billing safety fixes | yes | |
| 98 | part_cu_user_roles_private | user_roles no longer readable by all | check | |
| 99 | part_cv_group_key_rotation | Chat key rotation, database side | yes | |
| 100 | part_cw_project_member_removal | Owners remove members, members leave | yes | |
| 101 | part_cx_group_key_status | Which key version a chat is on | yes | |
| 102 | part_cy_storage_buckets | Storage bucket fixes | yes | |
| 103 | part_cz_staff_direct_edits | Closes staff direct-edit holes | check | |
| 104 | part_da_login_throttle_race | Sign-in throttle race fix | yes | After part_bn |
| 105 | part_db_blocks_follows_invites | Blocks, follows, stale invitations | yes | |
| 106 | part_dc_limits_throttle_announcements_nda | Plan limits, throttle, NDA in storage | yes | |
| 107 | part_dd_pitch_resubmit_keeps_records | Re-submitting a pitch keeps notes | yes | |
| 108 | part_de_hide_ignored_requests | Ignored requests not shown to sender | yes | |
| 109 | part_df_last_findings | Last small audit findings | yes | |
| 110 | part_dg_ignored_requests_private_table | Ignored requests in a private table | yes | |
| 111 | part_dh_login_lock_email | Tell account owner about password guessing | yes | |
| 112 | part_di_drop_profile_cover | Removes profile cover photo column | yes | Run once |
| 113 | part_dj_report_abuse | Report abuse limits | yes | |
| 114 | part_dk_verification_creators_only | Verified badge for creators only | yes | |
| 115 | part_dl_null_account_type_creator | Empty account type means creator | yes | |
| 116 | part_dm_fans_cannot_post | Fans cannot create posts | yes | |
| 117 | part_dn_jobs_poster_rules | Who may post a job | yes | |
| 118 | part_do_pitch_submit_rules | Who may submit a pitch | yes | |
| 119 | part_dp_report_abuse_followup | Report abuse follow-up | yes | After DJ |
| 120 | part_dq_storage_upload_rules | Server-side upload rules | yes | |
| 121 | part_dr_revoke_one_session | Sign out one device | yes | |
| 122 | part_ds_verification_legacy_company | Old company verification requests | yes | After DK |
| 123 | part_dt_storage_size_limits | File size limit on every bucket | yes | |
| 124 | part_dv_staff_console_fixes | Staff console fixes | check | |
| 125 | part_dz_mobile_group1_fixes | Mobile test group 1 fixes | check | |
| 126 | part_ea_mobile_group2_fixes | Mobile test group 2 fixes | check | |
| 127 | part_ec_room_prefs_sync | Room notification prefs sync across devices | check | |
| 128 | part_ee_space_member_roles | Space creator changes member roles | yes | After CL and CW |
| 129 | part_ef_super_admin_bootstrap | Makes a second super admin possible | yes | |
| 130 | part_eg_remove_super_admin | Remove a super admin, with two people | yes | |
| 131 | part_eh_hide_unfinished_profiles | Unfinished profiles are invisible | yes | |
| 132 | part_ei_fix_vendor_with_rating | Fixes vendor page 400 error | yes | |
| 133 | part_ej_remove_script_reader_pdfs | Removes the Script Reader leftovers | check | |
| 134 | part_ek_room_categories_read | Room categories readable again | yes | |
| 135 | part_el_dm_keys_close | Closes open dm_keys insert | yes | |
| 136 | part_em_revoke_trigger_functions | Trigger functions not callable via API | yes | |
| 137 | part_en_close_anon_rpc | Logged-out visitors cannot call login-only functions | yes | Run part_er soon after |
| 138 | part_eo_function_search_path | Fixed search_path on every function | yes | |
| 139 | part_ep_storage_no_listing | No listing of public buckets | yes | |
| 140 | part_eq_announcements_update_check | Announcement update checks new row | yes | |
| 141 | part_er_undo_en_server_only | Server-only functions back to server-only | yes | After EN |
| 142 | part_es_revoke_unused_rpc | Removes API permission from 30 unused functions | yes | After ER |
| 143 | part_et_anon_least_privilege | Least privilege for logged-out visitors | yes | After ER and ES. Makes system_incidents unreadable to visitors |
| 144 | part_eu_read_status_own_only | Mark as read only for yourself | yes | |
| 145 | part_ew_conversations_own_only | List only your own conversations | yes | |
| 146 | part_ex_move_pg_trgm | Moves pg_trgm out of public | yes | |
| 147 | part_ey_perf_initplan_and_dup_indexes | Performance: policy plans, duplicate indexes | yes | |
| 148 | part_ez_policy_roles_and_user_roles_dup | Performance: permissive policies step 1 | yes | |
| 149 | part_fa_merge_permissive_policies | Performance: merge overlapping policies, step 2 | check | Applies when run (dry run already done) |
| 150 | part_fb_close_open_policy_holes | Closes five read and write holes | yes | |
| 151 | part_fc_move_definer_functions | Moves definer function bodies to app_private | check | |
| 152 | part_fd_foreign_key_indexes | Indexes on foreign keys | yes | |

### Phase 5: bug fixes from browser testing (FE to FZ)

| # | File | What it adds | Safe to re-run | Special step |
|---|---|---|---|---|
| 153 | part_fe_announcements_notify_grant | Fixes 403 on list_announcements | yes | |
| 154 | part_fg_jobs_alerts_columns | Fixes jobs not publishing (job alert columns) | yes | |
| 155 | part_fh_projects_applicant_notification | Applicant told when approved or rejected | yes | |
| 156 | part_fh_projects_invite_links | Project invite links work | yes | |
| 157 | part_fh_projects_owner_notification | Owner told when someone applies | yes | |
| 158 | part_fh_projects_room_join_recursion | Fixes joining a public room (error 500) | yes | |
| 159 | part_fj_pitch_duplicate_notification | One pitch notification, not two | yes | |
| 160 | part_fj_pitch_rating_trigger_regex | Fixes rating a title (regex error) | yes | |
| 161 | part_fk1_settings_report_prepare_cast | Fixes new accounts unable to report | yes | |
| 162 | part_fk2_settings_missing_columns | Settings switches that never saved | yes | |
| 163 | part_fm_projects_room_policies_rebuild | Rebuilds room policies (fixes recursion for good) | yes | After FH |
| 164 | part_fm_projects_room_public_visibility | Public rooms visible to non-members | yes | After the rebuild |
| 165 | part_fm_projects_invite_policy_fix | Fixes creating invite links (403) | yes | After the rebuild |
| 166 | part_fn_settings_export_my_data | Fixes "Download your information" | yes | |
| 167 | part_fo_pitch_announcement_duplicate_notification | One announcement notification per follower, step 1 | yes | |
| 168 | part_fo_pitch_announcement_duplicate_notification_v2 | Step 2 | yes | After FO |
| 169 | part_fo2_announcement_notification_race | Step 3 (race fix) | yes | After FO v2 |
| 170 | part_fo_pitch_duplicate_notification_v2 | Duplicate pitch notification, final fix | yes | After FJ |
| 171 | part_fp_report_rules_profile_age | Fixes every report failing (created_at) | yes | |
| 172 | part_fq_edit_room_message | Edit your own room and project message (15 minutes) | yes | |
| 173 | part_fq_film_list_order | Own order for a film list | yes | |
| 174 | part_fq_my_reports | Settings > Help > Your reports | yes | |
| 175 | part_fq_pitch_call_delete | Delete a pitch call nobody pitched to | yes | |
| 176 | part_fr_calls_direct_channel_membership | Fixes new chats unable to start a call | yes | Do this before FR2 |
| 177 | part_fr2_calls_block_rules | Blocked people cannot call | yes | |
| 178 | part_fs_private_room_discoverability | "Who can find this room" for private rooms | yes | |
| 179 | part_ft_project_member_roles | Change a team member's role, with log and notice | yes | |
| 180 | part_fw_admin_user_notes | Staff notes on an account | yes | |
| 181 | part_fw_admin_user_record_created_at | Fixes empty "View record and strikes" | yes | |
| 182 | part_fx_super_audit_requests | Audit log records when a two-person request starts and ends | yes | |
| 183 | part_fx_super_platform_pulse | Super admin Overview numbers | yes | |
| 184 | part_fy_finance_invoices | Tax settings, numbered invoices, credit notes, finance report | yes | Tax rate starts at 0 (off) |
| 185 | part_fz_user_plan_stats | Paying vs free users card (admin and super admin) | yes | |

### Phase 6: the newest parts (GA to GI)

| # | File | What it adds | Safe to re-run | Special step |
|---|---|---|---|---|
| 186 | part_ga_mod_tools | Claim lock, escalation reason, repeat-offender facts, case timeline | yes | Before part_gh_mod_duplicates |
| 187 | part_gb_admin_support_desk | Assign tickets, ready replies, team workload | yes | |
| 188 | part_gb_admin_account_overview | Orders, devices, reports, strikes on an account record | yes | |
| 189 | part_gb_admin_exports | CSV exports: people, tickets, verification queue | yes | |
| 190 | part_gb_admin_saved_views | Saved filters on admin tables | yes | |
| 191 | part_gb_admin_report_approval_executor | Approved take-downs really get carried out; catches up old ones | yes | |
| 192 | part_gc_finance_role | Finance role, two-person refund approval | yes | Enum step: run the ALTER TYPE line alone first if the editor complains |
| 193 | part_gd_staff_security | Two-step sign-in switch (needs a second super admin), hidden /setup-admin, forced password change | yes | After part_bu and part_bi. Switch ships OFF |
| 194 | part_ge_dm_edit | Edit your own direct message (15 minutes) | yes | |
| 195 | part_ge_chat_prefs | Mute and pin for chats (max 3 pinned) | yes | |
| 196 | part_ge_call_busy | "On another call" check | yes | |
| 197 | part_gf_message_requests | Requests inbox, 3-message cap | yes | |
| 198 | part_gg_fan_call_rule | Fans cannot start calls | yes | |
| 199 | part_gh_mod_duplicates | Mark a case as a duplicate | yes | After part_ga |
| 200 | part_gh_mod_handover | Shift handover notes | yes | |
| 201 | part_gh_mod_queue_export | CSV export of the moderation queue | yes | Needs staff_rank and staff_mfa_ok (earlier parts) |
| 202 | part_gi_1_team_dashboards | Team numbers: support, trust, finance, growth | yes | |
| 203 | part_gi_2_compliance_pack | Data export request and erasure tracker | yes | |
| 204 | part_gi_3_oncall_rota | On-call rota | yes | |
| 205 | part_gi_4_status_page | Public /status page and incident desk | yes | |
| 206 | part_gi_5_staff_digest | Who gets the digest email | yes | After part_gi_1 |
| 207 | part_gi_6_schedule | Schedules the digest emails and Staff Watch | yes | Extensions, function, secrets (see below) |
| 208 | part_gi_7_digest_recipients_fix | Fixes the empty Digests list | yes | After part_gi_5 |
| 209 | part_fl_remove_test_accounts | Deletes the automated test accounts (cctest.*@example.com) and their content | check | LAST. Only when all testing is finished. Run steps 1 and 2 (read only) first |

part_fz_user_plan_stats (row 185) is one of the newest parts. Do not skip it: the "Paying and free users" card needs it.

Note on part_fl: it sorts in the middle of the letters (fl), but it must run last, after everything else and after all testing.

## Steps for part_gi_6_schedule

The file skips what is missing and prints a NOTICE. It never fails. Do these first so it can schedule everything.

1. Switch on the extensions `pg_cron` and `pg_net` (Dashboard > Database > Extensions).
2. Make sure part_gi_1 and part_gi_5 are applied.
3. Deploy the function: `supabase functions deploy staff-digest`.
4. Set the function secrets: `supabase secrets set STAFF_DIGEST_SECRET=<long random text> RESEND_API_KEY=<key> DIGEST_FROM="CineCraft <digest@yourdomain>"`.
5. Store the same random text for the database. Run this once in the SQL editor, with your own value in place of the placeholder. Never paste the real value into any file:
   `insert into public.app_settings (key, value) values ('staff_digest_secret', '<the same long random text>') on conflict (key) do update set value = excluded.value;`
6. Run part_gi_6_schedule.

## Steps for part_gc_finance_role (enum)

1. Run only this line first: `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';`
2. Run the rest of the file as a second batch.

## Notes

- Row numbers are only for counting. The letters are what matter.
- Anything that says "check" under Safe to re-run: TO CONFIRM by reading the file header before a second run.
- The rows in phase 1 and phase 2 were described from the file titles and the `supabase/manual/DEPLOY_CHECKLIST.md`. Read each file's header for the exact detail.

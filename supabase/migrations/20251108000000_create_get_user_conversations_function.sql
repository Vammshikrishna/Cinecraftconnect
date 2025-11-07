create or replace function get_user_conversations(p_user_id uuid)
returns table (
    other_user_id uuid,
    other_user_full_name text,
    other_user_username text,
    other_user_avatar_url text,
    last_message_content text,
    last_message_created_at timestamptz
)
language sql
as $$
    with conversations as (
        select
            distinct on (
                case
                    when sender_id = p_user_id then recipient_id
                    else sender_id
                end
            )
            case
                when sender_id = p_user_id then recipient_id
                else sender_id
            end as other_user,
            content,
            created_at
        from direct_messages
        where sender_id = p_user_id or recipient_id = p_user_id
        order by
            other_user,
            created_at desc
    )
    select
        p.id,
        p.full_name,
        p.username,
        p.avatar_url,
        c.content,
        c.created_at
    from conversations c
    join profiles p on c.other_user = p.id;
$$;

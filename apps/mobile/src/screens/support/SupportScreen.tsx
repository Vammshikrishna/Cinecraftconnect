import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import {
  HELP_CATEGORIES,
  HELP_ARTICLES,
  TICKET_TOPICS,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUS_LABEL,
  searchHelp,
  getHelpArticle,
  getHelpCategory,
  popularHelpArticles,
  articlesInCategory,
  type HelpArticle,
} from '@cinecraft/core';
import { getSupabaseClient } from '@cinecraft/api';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { pickAttachments } from '../../services/attachmentPicker';
import { uploadSupportAttachment, signedSupportUrl } from '../../services/resumeFiles';

type View_ =
  | { name: 'home' }
  | { name: 'category'; id: string }
  | { name: 'article'; id: string }
  | { name: 'requests' }
  | { name: 'ticket'; id: string }
  | { name: 'new'; topic?: string };

const CATEGORY_ICON: Record<string, string> = {
  rocket: 'zap', user: 'user', shield: 'shield', users: 'users', film: 'film',
  briefcase: 'briefcase', store: 'store', star: 'star', phone: 'phone', wrench: 'settings',
};
const STATUS_COLOR: Record<string, string> = { open: '#2563EB', in_progress: '#D97706', resolved: '#059669', closed: '#6B7280' };
const MAX_FILES = 3;

const timeAgo = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const SignedImage = ({ refPath, style }: { refPath: string; style: any }) => {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => { signedSupportUrl(refPath).then(setUri).catch(() => {}); }, [refPath]);
  return uri ? <Image source={{ uri }} style={style} /> : <View style={[style, { backgroundColor: '#8884' }]} />;
};

export const SupportScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const { themeColors } = useUserSettings();
  const c = themeColors;
  const [view, setView] = useState<View_>(route?.params?.ticketId ? { name: 'ticket', id: route.params.ticketId } : { name: 'home' });
  const [query, setQuery] = useState('');

  const go = (v: View_) => setView(v);
  const back = useCallback(() => {
    if (view.name === 'home') return false;
    if (view.name === 'article') {
      const a = getHelpArticle(view.id);
      setView(a ? { name: 'category', id: a.category } : { name: 'home' });
    } else if (view.name === 'ticket' || view.name === 'new') setView(view.name === 'ticket' ? { name: 'requests' } : { name: 'home' });
    else setView({ name: 'home' });
    return true;
  }, [view]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  // a notification can reopen the screen with a different ticket
  useEffect(() => {
    if (route?.params?.ticketId) setView({ name: 'ticket', id: route.params.ticketId });
  }, [route?.params?.ticketId]);

  const card = { backgroundColor: c.bgCard, borderColor: c.border };

  const ArticleRow = ({ a }: { a: HelpArticle }) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => go({ name: 'article', id: a.id })}>
      <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={2}>{a.title}</Text>
      <Icon name="chevron-right" size={16} color={c.textSecondary} />
    </TouchableOpacity>
  );

  // ── home ──
  const renderHome = () => {
    const results = query.trim().length >= 2 ? searchHelp(query, 8) : [];
    return (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.textPrimary }]}>How can we help?</Text>
        <View style={[styles.search, card]}>
          <Icon name="search" size={16} color={c.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: c.textPrimary }]}
            placeholder="Search for answers"
            placeholderTextColor={c.textSecondary}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {query.trim().length >= 2 ? (
          <View style={[styles.group, card]}>
            {results.length === 0 ? (
              <View style={{ padding: 18 }}>
                <Text style={{ color: c.textPrimary, fontWeight: '600' }}>No results for "{query}"</Text>
                <TouchableOpacity onPress={() => go({ name: 'new' })}><Text style={styles.link}>Contact support</Text></TouchableOpacity>
              </View>
            ) : results.map((a) => <ArticleRow key={a.id} a={a} />)}
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: c.textSecondary }]}>POPULAR</Text>
            <View style={[styles.group, card]}>{popularHelpArticles().slice(0, 5).map((a) => <ArticleRow key={a.id} a={a} />)}</View>

            <Text style={[styles.label, { color: c.textSecondary }]}>BROWSE BY TOPIC</Text>
            <View style={[styles.group, card]}>
              {HELP_CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat.id} style={[styles.row, { borderBottomColor: c.border }]} onPress={() => go({ name: 'category', id: cat.id })}>
                  <View style={styles.iconBox}><Icon name={(CATEGORY_ICON[cat.icon] || 'settings') as any} size={16} color="#FF4B33" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: c.textPrimary }]}>{cat.title}</Text>
                    <Text style={[styles.rowSub, { color: c.textSecondary }]} numberOfLines={1}>{cat.description}</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={c.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: c.textSecondary }]}>STILL NEED HELP?</Text>
            <View style={[styles.group, card]}>
              <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => go({ name: 'new' })}>
                <Text style={[styles.rowTitle, { color: c.textPrimary }]}>Contact support</Text>
                <Icon name="chevron-right" size={16} color={c.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => go({ name: 'requests' })}>
                <Text style={[styles.rowTitle, { color: c.textPrimary }]}>Your requests</Text>
                <Icon name="chevron-right" size={16} color={c.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => go({ name: 'new', topic: 'appeal' })}>
                <Text style={[styles.rowTitle, { color: c.textPrimary }]}>Appeal a decision</Text>
                <Icon name="chevron-right" size={16} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    );
  };

  // ── category ──
  const renderCategory = (id: string) => {
    const cat = getHelpCategory(id);
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { color: c.textPrimary }]}>{cat?.title}</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>{cat?.description}</Text>
        <View style={[styles.group, card]}>{articlesInCategory(id).map((a) => <ArticleRow key={a.id} a={a} />)}</View>
      </ScrollView>
    );
  };

  // ── article ──
  const ArticleView = ({ id }: { id: string }) => {
    const a = getHelpArticle(id);
    const [vote, setVote] = useState<null | boolean>(null);
    const [comment, setComment] = useState('');
    const [sent, setSent] = useState(false);
    if (!a) return <View style={styles.content}><Text style={{ color: c.textSecondary }}>That article does not exist.</Text></View>;
    const related = (a.related || []).map((r) => HELP_ARTICLES.find((x) => x.id === r)).filter(Boolean) as HelpArticle[];
    const send = async (helpful: boolean, text?: string) => {
      setVote(helpful);
      try { await (getSupabaseClient() as any).rpc('submit_help_feedback', { p_article: a.id, p_helpful: helpful, p_comment: text || null }); } catch { /* best effort */ }
      if (helpful || text !== undefined) setSent(true);
    };
    return (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.textPrimary }]}>{a.title}</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>{a.summary}</Text>
        {a.steps?.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
            <Text style={[styles.body, { color: c.textPrimary, flex: 1 }]}>{s}</Text>
          </View>
        ))}
        {a.body.map((p, i) => <Text key={i} style={[styles.body, { color: c.textSecondary, marginBottom: 10 }]}>{p}</Text>)}

        <View style={[styles.box, card]}>
          {sent ? (
            <Text style={{ color: c.textPrimary, fontWeight: '600' }}>Thanks for your feedback.</Text>
          ) : (
            <>
              <Text style={[styles.rowTitle, { color: c.textPrimary, marginBottom: 10 }]}>Was this article helpful?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[styles.pill, vote === true && styles.pillOn, { borderColor: c.border }]} onPress={() => send(true)}>
                  <Text style={{ color: vote === true ? '#fff' : c.textPrimary }}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pill, vote === false && styles.pillOn, { borderColor: c.border }]} onPress={() => setVote(false)}>
                  <Text style={{ color: vote === false ? '#fff' : c.textPrimary }}>No</Text>
                </TouchableOpacity>
              </View>
              {vote === false && (
                <View style={{ marginTop: 12 }}>
                  <TextInput
                    style={[styles.input, { color: c.textPrimary, borderColor: c.border, height: 70 }]}
                    multiline maxLength={300} value={comment} onChangeText={setComment}
                    placeholder="What was missing or unclear? (optional)" placeholderTextColor={c.textSecondary}
                  />
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => send(false, comment)}><Text style={styles.link}>Send feedback</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => go({ name: 'new' })}><Text style={styles.link}>Contact support</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {related.length > 0 && (
          <>
            <Text style={[styles.label, { color: c.textSecondary }]}>RELATED ARTICLES</Text>
            <View style={[styles.group, card]}>{related.map((r) => <ArticleRow key={r.id} a={r} />)}</View>
          </>
        )}
      </ScrollView>
    );
  };

  // ── requests list ──
  const RequestsView = () => {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
    useEffect(() => {
      (getSupabaseClient() as any).rpc('my_support_tickets').then(({ data }: any) => { setRows(data || []); setLoading(false); });
    }, []);
    const shown = rows.filter((r) => filter === 'all' || (filter === 'open' ? ['open', 'in_progress'].includes(r.status) : ['resolved', 'closed'].includes(r.status)));
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.h1, { color: c.textPrimary, marginBottom: 0 }]}>Your requests</Text>
          <TouchableOpacity style={styles.newBtn} onPress={() => go({ name: 'new' })}><Text style={styles.newBtnText}>New</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 14 }}>
          {([['all', 'All'], ['open', 'Open'], ['done', 'Resolved']] as const).map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.pill, filter === k && styles.pillOn, { borderColor: c.border }]} onPress={() => setFilter(k)}>
              <Text style={{ color: filter === k ? '#fff' : c.textPrimary }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading ? <ActivityIndicator color="#FF4B33" /> : shown.length === 0 ? (
          <View style={[styles.box, card, { alignItems: 'center' }]}>
            <Text style={{ color: c.textPrimary, fontWeight: '700' }}>{rows.length === 0 ? 'No requests yet' : 'Nothing here'}</Text>
            <Text style={{ color: c.textSecondary, marginTop: 4, textAlign: 'center' }}>
              {rows.length === 0 ? 'When you contact support, your conversation shows up here.' : 'Try a different filter.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.group, card]}>
            {shown.map((r) => (
              <TouchableOpacity key={r.id} style={[styles.row, { borderBottomColor: c.border }]} onPress={() => go({ name: 'ticket', id: r.id })}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.rowTitle, { color: c.textPrimary, flexShrink: 1 }]} numberOfLines={1}>{r.subject}</Text>
                    {r.staff_replied ? <View style={styles.dot} /> : null}
                  </View>
                  <Text style={[styles.rowSub, { color: c.textSecondary }]}>
                    {TICKET_CATEGORY_LABEL[r.category] || r.category} · {r.staff_replied ? 'Support replied · ' : ''}{timeAgo(r.last_message_at)}
                  </Text>
                </View>
                <Text style={[styles.badge, { color: STATUS_COLOR[r.status] || '#6B7280' }]}>{TICKET_STATUS_LABEL[r.status] || r.status}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  // ── one ticket ──
  const TicketView = ({ id }: { id: string }) => {
    const [ticket, setTicket] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [uid, setUid] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [rating, setRating] = useState(0);
    const [note, setNote] = useState('');
    const scroller = useRef<ScrollView>(null);

    const load = useCallback(async () => {
      const sb: any = getSupabaseClient();
      const [t, m, u] = await Promise.all([
        sb.from('support_tickets').select('*').eq('id', id).maybeSingle(),
        sb.from('support_ticket_messages').select('id, sender_id, content, created_at').eq('ticket_id', id).order('created_at', { ascending: true }),
        sb.auth.getUser(),
      ]);
      setTicket(t.data || null);
      setMessages(m.data || []);
      setUid(u.data?.user?.id || null);
      setLoading(false);
    }, [id]);

    useEffect(() => {
      load();
      const sb: any = getSupabaseClient();
      const ch = sb.channel(`ticket_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_ticket_messages', filter: `ticket_id=eq.${id}` }, () => load())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${id}` }, () => load())
        .subscribe();
      return () => { sb.removeChannel(ch); };
    }, [id, load]);

    const run = async (fn: string, args: any, ok?: string) => {
      const { error } = await (getSupabaseClient() as any).rpc(fn, args);
      if (error) Alert.alert('Could not complete', error.message);
      else if (ok) Alert.alert(ok);
      load();
    };

    const send = async () => {
      if (!reply.trim() || !uid) return;
      setSending(true);
      const { error } = await (getSupabaseClient() as any).from('support_ticket_messages').insert({ ticket_id: id, sender_id: uid, content: reply.trim() });
      setSending(false);
      if (error) return Alert.alert('Could not send', error.message);
      setReply('');
      load();
    };

    if (loading) return <View style={styles.content}><ActivityIndicator color="#FF4B33" /></View>;
    if (!ticket) return <View style={styles.content}><Text style={{ color: c.textSecondary }}>This request was not found.</Text></View>;

    const closed = ticket.status === 'closed';
    const done = ticket.status === 'resolved' || closed;
    const attachments: string[] = ticket.attachments?.length ? ticket.attachments : (ticket.attachment_url ? [ticket.attachment_url] : []);

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroller}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        >
          <Text style={[styles.badge, { color: STATUS_COLOR[ticket.status] || '#6B7280', marginBottom: 4 }]}>
            {TICKET_STATUS_LABEL[ticket.status] || ticket.status} · {TICKET_CATEGORY_LABEL[ticket.category] || ticket.category}
          </Text>
          <Text style={[styles.h1, { color: c.textPrimary, fontSize: 20 }]}>{ticket.subject}</Text>

          {!ticket.first_response_at && !done && (
            <View style={[styles.box, { backgroundColor: '#FF4B3312', borderColor: '#FF4B3333', marginBottom: 14 }]}>
              <Text style={{ color: c.textPrimary }}>We have your request. We usually reply within 24 hours and you will get a notification when we do.</Text>
            </View>
          )}

          <View style={[styles.bubble, styles.mine]}>
            <Text style={styles.mineText}>{ticket.message}</Text>
            {attachments.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {attachments.map((a) => <SignedImage key={a} refPath={a} style={styles.thumb} />)}
              </View>
            )}
          </View>
          {messages.map((m) => {
            const mine = m.sender_id === uid;
            return (
              <View key={m.id} style={[styles.bubble, mine ? styles.mine : { alignSelf: 'flex-start', backgroundColor: c.bgCard, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]}>
                {!mine && <Text style={styles.staffName}>CineCraft Support</Text>}
                <Text style={mine ? styles.mineText : { color: c.textPrimary, fontSize: 15 }}>{m.content}</Text>
                <Text style={{ fontSize: 11, marginTop: 4, color: mine ? '#ffffffb0' : c.textSecondary }}>{timeAgo(m.created_at)}</Text>
              </View>
            );
          })}

          {done && (
            <View style={[styles.box, card, { marginTop: 8 }]}>
              {ticket.csat_rating ? (
                <Text style={{ color: c.textPrimary }}>You rated this {ticket.csat_rating} out of 5. Thank you.</Text>
              ) : (
                <>
                  <Text style={[styles.rowTitle, { color: c.textPrimary, marginBottom: 8 }]}>How did we do?</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity key={n} onPress={() => setRating(n)}>
                        <Icon name="star" size={28} color={n <= rating ? '#F59E0B' : c.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  {rating > 0 && (
                    <>
                      <TextInput
                        style={[styles.input, { color: c.textPrimary, borderColor: c.border, height: 60 }]}
                        multiline maxLength={500} value={note} onChangeText={setNote}
                        placeholder="Anything you want to add? (optional)" placeholderTextColor={c.textSecondary}
                      />
                      <TouchableOpacity style={[styles.newBtn, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={() => run('rate_support_ticket', { p_id: id, p_rating: rating, p_comment: note || null }, 'Thanks for your feedback')}>
                        <Text style={styles.newBtnText}>Submit</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {closed ? (
            <View style={[styles.box, card, { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={{ color: c.textSecondary }}>This request is closed.</Text>
              <TouchableOpacity onPress={() => run('reopen_support_ticket', { p_id: id }, 'Request reopened')}><Text style={styles.link}>Reopen</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              <TextInput
                style={[styles.input, { color: c.textPrimary, borderColor: c.border, height: 80 }]}
                multiline maxLength={4000} value={reply} onChangeText={setReply}
                placeholder={done ? 'Reply to reopen this request…' : 'Write a reply…'} placeholderTextColor={c.textSecondary}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <TouchableOpacity onPress={() => run('close_support_ticket', { p_id: id }, 'Request closed')}><Text style={{ color: c.textSecondary }}>Close request</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.newBtn, (!reply.trim() || sending) && { opacity: 0.5 }]} disabled={!reply.trim() || sending} onPress={send}>
                  <Text style={styles.newBtnText}>{sending ? 'Sending…' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // ── new request ──
  const NewView = ({ initialTopic }: { initialTopic?: string }) => {
    const [topicId, setTopicId] = useState<string | null>(initialTopic && TICKET_TOPICS.some((t) => t.id === initialTopic) ? initialTopic : null);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [files, setFiles] = useState<{ ref: string; uri: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [diag, setDiag] = useState(true);
    const [sending, setSending] = useState(false);
    const topic = TICKET_TOPICS.find((t) => t.id === topicId);
    const suggestions = useMemo(() => searchHelp(`${subject} ${message}`, 3), [subject, message]);

    const addFile = async () => {
      if (files.length >= MAX_FILES) return;
      try {
        const picked = await pickAttachments({ multiple: false, allowFiles: false, photosOnly: true });
        if (!picked.length) return;
        setUploading(true);
        const ref = await uploadSupportAttachment(picked[0]);
        setFiles((prev) => [...prev, { ref, uri: picked[0].uri }]);
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message || 'Please try again.');
      } finally {
        setUploading(false);
      }
    };

    const submit = async () => {
      if (!topic) return;
      setSending(true);
      try {
        const sb: any = getSupabaseClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return Alert.alert('Sign in required', 'Please sign in to contact support.');
        const diagnostics = diag ? {
          app: 'mobile', platform: Platform.OS, osVersion: String(Platform.Version), page: 'help',
        } : null;
        const { data, error } = await sb.from('support_tickets').insert({
          user_id: user.id, subject: subject.trim(), message: message.trim(), category: topic.category,
          attachments: files.map((f) => f.ref), attachment_url: files[0]?.ref || null, diagnostics,
        }).select('id').single();
        if (error) throw error;
        Alert.alert('Request sent', 'We usually reply within 24 hours. You will be notified here.');
        go({ name: 'ticket', id: data.id });
      } catch (e: any) {
        Alert.alert('Could not send your request', e?.message || 'Please try again.');
      } finally {
        setSending(false);
      }
    };

    if (!topic) {
      return (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.h1, { color: c.textPrimary }]}>Contact support</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>What do you need help with?</Text>
          <View style={[styles.group, card]}>
            {TICKET_TOPICS.map((t) => (
              <TouchableOpacity key={t.id} style={[styles.row, { borderBottomColor: c.border }]} onPress={() => setTopicId(t.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: c.textPrimary }]}>{t.label}</Text>
                  <Text style={[styles.rowSub, { color: c.textSecondary }]}>{t.description}</Text>
                </View>
                <Icon name="chevron-right" size={16} color={c.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      );
    }

    const ready = subject.trim().length >= 3 && message.trim().length >= 10 && !uploading;
    return (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setTopicId(null)}><Text style={[styles.link, { marginBottom: 8 }]}>← Change topic</Text></TouchableOpacity>
        <Text style={[styles.h1, { color: c.textPrimary }]}>{topic.label}</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>{topic.tip}</Text>

        <Text style={[styles.fieldLabel, { color: c.textPrimary }]}>Subject</Text>
        <TextInput style={[styles.input, { color: c.textPrimary, borderColor: c.border }]} maxLength={120} value={subject} onChangeText={setSubject} placeholder="A short summary" placeholderTextColor={c.textSecondary} />

        <Text style={[styles.fieldLabel, { color: c.textPrimary }]}>Details</Text>
        <TextInput
          style={[styles.input, { color: c.textPrimary, borderColor: c.border, height: 140, textAlignVertical: 'top' }]}
          multiline maxLength={4000} value={message} onChangeText={setMessage} placeholder={topic.placeholder} placeholderTextColor={c.textSecondary}
        />

        {suggestions.length > 0 && (
          <View style={[styles.box, { backgroundColor: '#FF4B3312', borderColor: '#FF4B3333', marginTop: 14 }]}>
            <Text style={{ color: c.textPrimary, fontWeight: '600', marginBottom: 6 }}>These articles may answer your question</Text>
            {suggestions.map((a) => (
              <TouchableOpacity key={a.id} onPress={() => go({ name: 'article', id: a.id })}><Text style={[styles.link, { marginVertical: 3 }]}>{a.title}</Text></TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[styles.fieldLabel, { color: c.textPrimary }]}>Screenshots (optional, up to {MAX_FILES})</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {files.map((f, i) => (
            <TouchableOpacity key={f.ref} onPress={() => setFiles(files.filter((_, j) => j !== i))}>
              <Image source={{ uri: f.uri }} style={styles.thumb} />
              <View style={styles.removeBadge}><Text style={{ color: '#fff', fontSize: 11 }}>✕</Text></View>
            </TouchableOpacity>
          ))}
          {files.length < MAX_FILES && (
            <TouchableOpacity style={[styles.thumb, styles.addThumb, { borderColor: c.border }]} onPress={addFile}>
              {uploading ? <ActivityIndicator color="#FF4B33" /> : <Icon name="plus" size={20} color={c.textSecondary} />}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.box, card, { marginTop: 16, flexDirection: 'row', gap: 10 }]} onPress={() => setDiag(!diag)}>
          <View style={[styles.check, diag && { backgroundColor: '#FF4B33', borderColor: '#FF4B33' }]}>{diag ? <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text> : null}</View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.textPrimary, fontWeight: '600' }}>Include technical details</Text>
            <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>Your device, OS version and app. This helps us fix problems faster. No messages or personal content are included.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.submit, (!ready || sending) && { opacity: 0.5 }]} disabled={!ready || sending} onPress={submit}>
          <Text style={styles.submitText}>{sending ? 'Sending…' : 'Send request'}</Text>
        </TouchableOpacity>
        <Text style={{ color: c.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 10 }}>We usually reply within 24 hours. Safety reports and appeals are reviewed first.</Text>
      </ScrollView>
    );
  };

  const title =
    view.name === 'home' ? 'Help Center'
    : view.name === 'requests' ? 'Your requests'
    : view.name === 'ticket' ? 'Request'
    : view.name === 'new' ? 'Contact support'
    : view.name === 'category' ? 'Help' : 'Article';

  return (
    <View style={[styles.container, { backgroundColor: c.bgScreen }]}>
      <Header title={title} showLogo={false} onBack={() => { if (!back()) navigation.goBack(); }} />
      {view.name === 'home' && renderHome()}
      {view.name === 'category' && renderCategory(view.id)}
      {view.name === 'article' && <ArticleView key={view.id} id={view.id} />}
      {view.name === 'requests' && <RequestsView />}
      {view.name === 'ticket' && <TicketView key={view.id} id={view.id} />}
      {view.name === 'new' && <NewView key={view.topic || 'new'} initialTopic={view.topic} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  sub: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 46, marginTop: 8, marginBottom: 4 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  group: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  rowSub: { fontSize: 12, marginTop: 2 },
  iconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF4B3318', alignItems: 'center', justifyContent: 'center' },
  link: { color: '#FF4B33', fontWeight: '600', fontSize: 14 },
  step: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF4B3318', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { color: '#FF4B33', fontWeight: '700', fontSize: 12 },
  body: { fontSize: 15, lineHeight: 22 },
  box: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  pillOn: { backgroundColor: '#FF4B33', borderColor: '#FF4B33' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  newBtn: { backgroundColor: '#FF4B33', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  newBtnText: { color: '#fff', fontWeight: '700' },
  badge: { fontSize: 12, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4B33' },
  bubble: { maxWidth: '85%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#FF4B33' },
  mineText: { color: '#fff', fontSize: 15 },
  staffName: { fontSize: 11, fontWeight: '700', color: '#FF4B33', marginBottom: 2 },
  thumb: { width: 80, height: 80, borderRadius: 12 },
  addThumb: { borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  removeBadge: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#999', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  submit: { backgroundColor: '#FF4B33', borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

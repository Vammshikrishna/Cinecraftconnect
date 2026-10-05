import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { HELP_ARTICLES, getHelpArticle, getHelpCategory } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SettingsSection } from '@/components/settings/SettingsUI';
import { ArticleRow, HelpBack } from '@/components/help/HelpParts';

const HelpArticlePage = () => {
  const { id = '' } = useParams();
  const article = getHelpArticle(id);
  const [vote, setVote] = useState<null | boolean>(null);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);

  if (!article) {
    return (
      <>
        <HelpBack to="/settings/help" label="Help Center" />
        <p className="text-muted-foreground">That article does not exist.</p>
      </>
    );
  }
  const category = getHelpCategory(article.category);
  const related = (article.related || []).map(r => HELP_ARTICLES.find(a => a.id === r)).filter(Boolean) as typeof HELP_ARTICLES;

  const send = async (helpful: boolean, text?: string) => {
    setVote(helpful);
    await (supabase as any).rpc('submit_help_feedback', { p_article: article.id, p_helpful: helpful, p_comment: text || null });
    if (helpful || text !== undefined) setSent(true);
  };

  return (
    <>
      <HelpBack to={`/settings/help/category/${article.category}`} label={category?.title || 'Help Center'} />
      <h2 className="text-2xl font-bold leading-tight">{article.title}</h2>
      <p className="text-muted-foreground mt-1 mb-6">{article.summary}</p>

      {article.steps && (
        <ol className="space-y-3 mb-6">
          {article.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <p className="text-[15px] leading-relaxed">{s}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="space-y-3 mb-8">
        {article.body.map((p, i) => <p key={i} className="text-[15px] leading-relaxed text-muted-foreground">{p}</p>)}
      </div>

      <div className="rounded-2xl border bg-card p-5 mb-8">
        {sent ? (
          <p className="text-sm font-medium">Thanks for your feedback. {vote === false && <>If you still need help, <Link to="/settings/help/new" className="text-primary">contact support</Link>.</>}</p>
        ) : (
          <>
            <p className="font-semibold text-[15px] mb-3">Was this article helpful?</p>
            <div className="flex gap-2">
              <Button variant={vote === true ? 'default' : 'outline'} size="sm" onClick={() => send(true)}><ThumbsUp className="h-4 w-4 mr-1.5" /> Yes</Button>
              <Button variant={vote === false ? 'default' : 'outline'} size="sm" onClick={() => setVote(false)}><ThumbsDown className="h-4 w-4 mr-1.5" /> No</Button>
            </div>
            {vote === false && (
              <div className="mt-4 space-y-2">
                <Textarea rows={3} maxLength={300} value={comment} onChange={e => setComment(e.target.value)} placeholder="What was missing or unclear? (optional)" className="resize-none" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => send(false, comment)}>Send feedback</Button>
                  <Button size="sm" variant="ghost" asChild><Link to="/settings/help/new">Contact support</Link></Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {related.length > 0 && (
        <SettingsSection title="Related articles">
          {related.map(a => <ArticleRow key={a.id} article={a} />)}
        </SettingsSection>
      )}
    </>
  );
};

export default HelpArticlePage;

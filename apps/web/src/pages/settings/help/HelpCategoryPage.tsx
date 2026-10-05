import { Link, useParams } from 'react-router-dom';
import { articlesInCategory, getHelpCategory } from '@cinecraft/core';
import { SettingsPageHeader, SettingsSection } from '@/components/settings/SettingsUI';
import { ArticleRow, HelpBack } from '@/components/help/HelpParts';

const HelpCategoryPage = () => {
  const { id = '' } = useParams();
  const category = getHelpCategory(id);
  if (!category) {
    return (
      <>
        <HelpBack to="/settings/help" label="Help Center" />
        <p className="text-muted-foreground">That topic does not exist.</p>
      </>
    );
  }
  const articles = articlesInCategory(id);
  return (
    <>
      <HelpBack to="/settings/help" label="Help Center" />
      <SettingsPageHeader title={category.title} description={category.description} />
      <SettingsSection>
        {articles.map(a => <ArticleRow key={a.id} article={a} />)}
      </SettingsSection>
      <p className="text-sm text-muted-foreground">Can't find what you need? <Link to="/settings/help/new" className="text-primary font-medium">Contact support</Link></p>
    </>
  );
};

export default HelpCategoryPage;

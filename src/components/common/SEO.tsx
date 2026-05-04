import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
}

const SEO = ({ title, description, keywords }: SEOProps) => {
  useEffect(() => {
    // Update Document Title
    const baseTitle = "CineCraft Connect";
    const fullTitle = title ? `${title} | ${baseTitle}` : `${baseTitle} | The Professional Entertainment Ecosystem`;
    document.title = fullTitle;

    // Update Meta Description
    if (description) {
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', description);
      }
    }

    // Update Meta Keywords
    if (keywords) {
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', keywords);
      }
    }

    // Update OpenGraph Title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', fullTitle);
    }
  }, [title, description, keywords]);

  return null; // This component doesn't render anything to the DOM
};

export default SEO;

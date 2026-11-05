import { Fragment } from 'react';

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;
const TRAILING = /[.,;:!?)\]}]+$/;

/** Plain chat text where http(s) links are tappable (opens in a new tab, no referrer). Anything else is shown as typed. */
export const LinkifiedText = ({ text }: { text: string }) => {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const trail = (part.match(TRAILING) || [''])[0];
        const url = trail ? part.slice(0, -trail.length) : part;
        return (
          <Fragment key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 break-all" onClick={(e) => e.stopPropagation()}>{url}</a>
            {trail}
          </Fragment>
        );
      })}
    </>
  );
};

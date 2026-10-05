import { Navigate, useParams } from 'react-router-dom';

/** /u/<username> is the short, shareable form of /profile/<username>. */
const UsernameRedirect = () => {
  const { identifier } = useParams<{ identifier: string }>();
  return <Navigate to={`/profile/${encodeURIComponent(identifier || '')}`} replace />;
};

export default UsernameRedirect;

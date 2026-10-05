import { Navigate, useParams } from 'react-router-dom';

/** Old /support/ticket/:id links open the request inside Settings. */
const SupportTicketRedirect = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  return <Navigate to={`/settings/help/requests/${ticketId}`} replace />;
};

export default SupportTicketRedirect;

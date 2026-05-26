import { Navigate } from "react-router-dom";

const Notifications = () => {
  // Notifications are now primarily driven by InApp overlays and Native MessagingStyle.
  // The persistent source of truth is now the Chats/Messages view.
  return <Navigate to="/messages" replace />;
};

export default Notifications;

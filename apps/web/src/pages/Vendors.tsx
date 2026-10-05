import { Navigate } from 'react-router-dom';

/** The vendor directory is the "Services" tab of the Marketplace now. Old links and bookmarks land there. */
const Vendors = () => <Navigate to="/marketplace?tab=services" replace />;

export default Vendors;

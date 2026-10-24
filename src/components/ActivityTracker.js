/**
 * ActivityTracker
 *
 * Headless component that runs the utilization-tracking engine for the current
 * user. Mounted once inside the authenticated app shell; renders nothing.
 */

import { useAuth } from '../contexts/AuthContext';
import useActivityTracker from '../hooks/useActivityTracker';

const ActivityTracker = () => {
  const { user } = useAuth();
  useActivityTracker(user);
  return null;
};

export default ActivityTracker;

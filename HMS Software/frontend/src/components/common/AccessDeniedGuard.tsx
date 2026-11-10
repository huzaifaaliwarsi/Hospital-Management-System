import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { PortalKey } from '../../types';
import { PORTAL_CONFIGS } from '../../constants/portalNavigations';

interface AccessDeniedGuardProps {
  attemptedPortal: PortalKey;
  customTitle?: string;
  customDescription?: string;
}

export const AccessDeniedGuard: React.FC<AccessDeniedGuardProps> = ({
  attemptedPortal,
  customTitle,
  customDescription,
}) => {
  const { currentUser, logout, switchPortal } = useAuth();
  const { navigate } = useRouter();

  const attemptedConfig = PORTAL_CONFIGS[attemptedPortal] || {
    name: attemptedPortal,
    shortName: attemptedPortal,
    routePrefix: `/${attemptedPortal}`,
  };

  const userHomePortal = currentUser?.allowedPortals[0] || 'front-desk';
  const userHomeConfig = PORTAL_CONFIGS[userHomePortal];

  const handleReturnHome = () => {
    switchPortal(userHomePortal);
    navigate(`${userHomeConfig.routePrefix}/dashboard`);
  };

  const handleSwitchAccount = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Banner */}
        <div className="bg-rose-900 text-white p-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-800 flex items-center justify-center mb-3">
            <ShieldAlert className="h-6 w-6 text-rose-200" />
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase bg-rose-800/80 px-2.5 py-1 rounded-full text-rose-200">
            Security Permission Guard
          </span>
          <h2 className="text-lg font-bold mt-2">
            {customTitle || 'Unauthorized Portal Access'}
          </h2>
          <p className="text-xs text-rose-200 mt-1">
            {customDescription || `Access to ${attemptedConfig.name} is restricted`}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>Active Staff Member:</span>
              <span className="font-semibold text-slate-800">{currentUser?.name || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Assigned Role:</span>
              <span className="font-semibold text-slate-800">{currentUser?.role || 'Guest'}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Authorized Subsystem:</span>
              <span className="font-semibold text-emerald-700">{userHomeConfig?.name}</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Under CH Sharif and Saeed Hospital security policy, staff credentials are strictly isolated per operational department. You cannot access {attemptedConfig.name} with this account.
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleReturnHome}
              className="w-full py-2.5 px-4 rounded-lg bg-[#149E75] hover:bg-[#08775A] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to {userHomeConfig?.shortName} Dashboard</span>
            </button>

            <button
              type="button"
              onClick={handleSwitchAccount}
              className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4 text-slate-500" />
              <span>Sign In with Different Staff Account</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400">
          CH Sharif & Saeed Hospital Audit System • Security Event Logged
        </div>
      </div>
    </div>
  );
};

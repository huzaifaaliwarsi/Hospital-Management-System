import React from 'react';
import { CentralHospitalLoginScreen } from './CentralHospitalLoginScreen';
import { PortalKey } from '../../types';

export interface PortalLoginScreenProps {
  portalKey?: PortalKey;
  targetPortal?: PortalKey;
  onLoginSuccess?: (portal: PortalKey) => void;
}

export const PortalLoginScreen: React.FC<PortalLoginScreenProps> = ({
  portalKey,
  targetPortal,
  onLoginSuccess,
}) => {
  return (
    <CentralHospitalLoginScreen
      initialPortal={targetPortal || portalKey || null}
      onLoginSuccess={onLoginSuccess}
    />
  );
};

export { CentralHospitalLoginScreen };

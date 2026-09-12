export interface CorporatePanel {
  id: string;
  code: string;
  name: string;
  category: 'Govt Health Insurance' | 'Private Insurance' | 'Armed Forces Welfare' | 'Corporate Enterprise';
  discountAgreement: string;
  creditLimit: number;
  status: 'Active' | 'Expired';
  isDemo?: boolean;
}

// Strictly generic demo corporate panels for client demonstration.
// No unverified claims of contracted organizations (State Life, EFU, Jubilee, Fauji, etc.).
export const CENTRAL_CORPORATE_PANELS: CorporatePanel[] = [
  {
    id: 'DEMO-PNL-01',
    code: 'DEMO-PNL-A',
    name: 'Demo Corporate Panel A',
    category: 'Corporate Enterprise',
    discountAgreement: 'Demo Institutional Tariff - 15% Concession',
    creditLimit: 10000000,
    status: 'Active',
    isDemo: true,
  },
  {
    id: 'DEMO-PNL-02',
    code: 'DEMO-PNL-B',
    name: 'Demo Insurance Panel B',
    category: 'Private Insurance',
    discountAgreement: 'Demo Insurance Tariff - Pre-authorized Coverage',
    creditLimit: 15000000,
    status: 'Active',
    isDemo: true,
  },
  {
    id: 'DEMO-PNL-03',
    code: 'DEMO-PNL-C',
    name: 'Demo Employer Panel C',
    category: 'Corporate Enterprise',
    discountAgreement: 'Demo Direct Billing Panel',
    creditLimit: 8000000,
    status: 'Active',
    isDemo: true,
  },
];

export function getActiveCorporatePanels(): CorporatePanel[] {
  return CENTRAL_CORPORATE_PANELS.filter((p) => p.status === 'Active');
}

export function getPanelById(id: string): CorporatePanel | undefined {
  return CENTRAL_CORPORATE_PANELS.find((p) => p.id === id);
}

export function getPanelByCode(code: string): CorporatePanel | undefined {
  const norm = code.trim().toUpperCase();
  return CENTRAL_CORPORATE_PANELS.find(
    (p) => p.code.toUpperCase() === norm || p.id.toUpperCase() === norm
  );
}

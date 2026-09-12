import React from 'react';
import {
  FileCheck,
  Activity,
  Stethoscope,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';
import { HospitalService } from '../../../types/serviceRates';
import { ServiceRatesService } from '../../../services/serviceRatesService';

interface ServicesKPIBarProps {
  services: HospitalService[];
}

export const ServicesKPIBar: React.FC<ServicesKPIBarProps> = ({ services }) => {
  const kpis = ServiceRatesService.getKPIs(services);

  const cards = [
    {
      id: 'kpi_total',
      label: 'Total Charge Master Services',
      value: kpis.totalServices,
      subtext: 'Catalog Master Records',
      icon: FileCheck,
      iconColor: 'text-slate-700',
      iconBg: 'bg-slate-100',
    },
    {
      id: 'kpi_active',
      label: 'Active Billable Services',
      value: kpis.activeServices,
      subtext: 'Orderable at Billing Counters',
      icon: Activity,
      iconColor: 'text-emerald-700',
      iconBg: 'bg-emerald-50',
      accent: 'border-emerald-200',
    },
    {
      id: 'kpi_clinical',
      label: 'Clinical & Inpatient',
      value: kpis.clinicalServices,
      subtext: 'OPD, ER, Wards & Observation',
      icon: Stethoscope,
      iconColor: 'text-teal-700',
      iconBg: 'bg-teal-50',
    },
    {
      id: 'kpi_diagnostic',
      label: 'Diagnostics & Procedures',
      value: kpis.diagnosticProcedureServices,
      subtext: 'Lab, Radiology & Operations',
      icon: FlaskConical,
      iconColor: 'text-indigo-700',
      iconBg: 'bg-indigo-50',
    },
    {
      id: 'kpi_panel',
      label: 'Panel Eligible Services',
      value: kpis.panelEligibleServices,
      subtext: 'Insurance / Corporate Tariffs',
      icon: ShieldCheck,
      iconColor: 'text-emerald-800',
      iconBg: 'bg-emerald-100/70',
    },
  ];

  return (
    <div id="services-kpi-bar" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            id={card.id}
            className={`bg-white rounded-xl p-4 border transition-all duration-200 shadow-xs hover:shadow-sm flex flex-col justify-between ${
              card.accent ? `${card.accent} shadow-xs` : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-2 rounded-lg ${card.iconBg} ${card.iconColor} shrink-0 ml-2`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {(card.value ?? 0).toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{card.subtext}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

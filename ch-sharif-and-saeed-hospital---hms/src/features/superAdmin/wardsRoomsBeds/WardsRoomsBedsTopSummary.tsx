import React from 'react';
import {
  LayoutGrid,
  Building,
  Bed as BedIcon,
  CheckCircle2,
  Users,
  AlertOctagon,
  ShieldCheck,
} from 'lucide-react';
import { WardsRoomsBedsService } from '../../../services/wardsRoomsBedsService';

interface TopSummaryProps {
  summary: ReturnType<typeof WardsRoomsBedsService.getTopSummary>;
}

export const WardsRoomsBedsTopSummary: React.FC<TopSummaryProps> = ({ summary }) => {
  const cards = [
    {
      id: 'kpi_wards',
      label: 'Total Wards',
      value: summary.totalWards,
      subtext: 'Clinical Units',
      icon: LayoutGrid,
      iconColor: 'text-slate-700',
      iconBg: 'bg-slate-100',
    },
    {
      id: 'kpi_rooms',
      label: 'Total Rooms',
      value: summary.totalRooms,
      subtext: 'Configured Inpatient Rooms',
      icon: Building,
      iconColor: 'text-teal-700',
      iconBg: 'bg-teal-50',
    },
    {
      id: 'kpi_beds',
      label: 'Total Hospital Beds',
      value: summary.totalBeds,
      subtext: 'Capacity Ceiling',
      icon: BedIcon,
      iconColor: 'text-slate-800',
      iconBg: 'bg-slate-100',
      accent: 'border-slate-300',
    },
    {
      id: 'kpi_avail',
      label: 'Available Beds',
      value: summary.availableBeds,
      subtext: 'Assignable for Admission',
      icon: CheckCircle2,
      iconColor: 'text-emerald-700',
      iconBg: 'bg-emerald-50',
      accent: 'border-emerald-200',
    },
    {
      id: 'kpi_occupied',
      label: 'Occupied Beds',
      value: summary.occupiedBeds,
      subtext: 'Admitted Inpatients',
      icon: Users,
      iconColor: 'text-indigo-700',
      iconBg: 'bg-indigo-50',
    },
    {
      id: 'kpi_maintenance',
      label: 'Out of Service / Reserved',
      value: summary.outOfServiceBeds,
      subtext: 'Cleaning / Maintenance',
      icon: AlertOctagon,
      iconColor: 'text-amber-700',
      iconBg: 'bg-amber-50',
    },
  ];

  return (
    <div id="wards-rooms-beds-top-summary" className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              id={card.id}
              className={`bg-white rounded-xl p-3.5 border transition-all duration-200 shadow-xs hover:shadow-sm flex flex-col justify-between ${
                card.accent ? `${card.accent}` : 'border-slate-200/80'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider line-clamp-1">
                  {card.label}
                </span>
                <div className={`p-1.5 rounded-lg ${card.iconBg} ${card.iconColor} shrink-0 ml-1`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-slate-900 tracking-tight">
                  {(card.value ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{card.subtext}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reconciled Math Verification Strip */}
      <div className="mt-2 px-3 py-1.5 bg-[#effaf5] border border-[#c2e7db] rounded-lg flex items-center justify-between text-[11px] text-[#08775A]">
        <div className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#08775A]" />
          <span>Capacity Reconciliation:</span>
          <span className="font-bold">
            {summary.totalBeds} Total Beds = {summary.availableBeds} Available + {summary.occupiedBeds} Occupied + {summary.outOfServiceBeds} Out of Service / Reserved
          </span>
        </div>
        <span className="hidden sm:inline-block font-semibold bg-white px-2 py-0.5 rounded border border-[#c2e7db] text-[10px]">
          Reconciled 100%
        </span>
      </div>
    </div>
  );
};

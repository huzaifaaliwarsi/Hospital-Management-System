import React, { useState, useEffect } from 'react';
import {
  Layers,
  Users,
  UserCheck,
  Building,
  Bed,
  DoorOpen,
  Briefcase,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from '../../../context/RouterContext';
import {
  getHospitalSystemSummaryAggregates,
  DEFAULT_HOSPITAL_SYSTEM_AGGREGATES,
} from '../../../mocks/hospitalSummaryMock';
import { HospitalSystemAggregateCounts } from '../../../types/hospital';

interface HospitalSystemSummarySectionProps {
  aggregates?: HospitalSystemAggregateCounts;
}

export const HospitalSystemSummarySection: React.FC<HospitalSystemSummarySectionProps> = ({
  aggregates: propAggregates,
}) => {
  const { navigate } = useRouter();
  const [data, setData] = useState<HospitalSystemAggregateCounts>(
    propAggregates || DEFAULT_HOSPITAL_SYSTEM_AGGREGATES
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAggregates = async () => {
    setIsRefreshing(true);
    try {
      const live = await getHospitalSystemSummaryAggregates();
      setData(live);
    } catch (err) {
      console.error('Failed to load live aggregates:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (propAggregates) {
      setData(propAggregates);
    } else {
      loadAggregates();
    }
  }, [propAggregates]);

  const summaryMetrics = [
    {
      id: 'departments',
      label: 'Departments',
      count: data.departments,
      subtext: 'Clinical & Diagnostics',
      icon: Layers,
      actionLabel: 'View Departments',
      route: '/super-admin/departments',
    },
    {
      id: 'doctors',
      label: 'Doctors',
      count: data.doctors,
      subtext: 'Consultants & MOs',
      icon: Users,
      actionLabel: 'View Doctors',
      route: '/super-admin/staff_users',
    },
    {
      id: 'staff',
      label: 'Staff Users',
      count: data.staffUsers,
      subtext: 'Nursing, Pharmacy & Admin',
      icon: UserCheck,
      actionLabel: 'View Staff',
      route: '/super-admin/staff_users',
    },
    {
      id: 'wards',
      label: 'Inpatient Wards',
      count: data.inpatientWards,
      subtext: 'ICU, CCU, General & Private',
      icon: Building,
      actionLabel: 'View Wards & Beds',
      route: '/super-admin/bed_management',
    },
    {
      id: 'rooms',
      label: 'Hospital Rooms',
      count: data.hospitalRooms,
      subtext: 'Single & Deluxe Suites',
      icon: DoorOpen,
      actionLabel: 'View Wards & Beds',
      route: '/super-admin/bed_management',
    },
    {
      id: 'beds',
      label: 'Total Beds',
      count: data.totalBeds,
      subtext: 'Sanctioned Operating Beds',
      icon: Bed,
      actionLabel: 'View Wards & Beds',
      route: '/super-admin/bed_management',
    },
    {
      id: 'panels',
      label: 'Active Panels',
      count: data.activePanels,
      subtext: 'Insurance & Corporate TPA',
      icon: Briefcase,
      actionLabel: 'View Panels',
      route: '/super-admin/corporate_panels',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#e2eae5] gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Hospital System Summary</h3>
            <p className="text-[11px] text-[#52665e]">
              Real-time live operational aggregate counts from the database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadAggregates}
            disabled={isRefreshing}
            className="p-1 text-[#52665e] hover:text-[#08775A] rounded hover:bg-[#f6faf8] transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Live Aggregates"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#08775A]' : ''}`} />
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#08775A] bg-[#effaf5] px-2.5 py-1 rounded-md border border-[#c2e7db]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
            Live Database Aggregates
          </span>
        </div>
      </div>

      {/* Grid of System Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {summaryMetrics.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-[#f6faf8] border border-[#e2eae5] flex flex-col justify-between hover:border-[#c2e7db] hover:shadow-2xs transition-all group"
            >
              <div>
                <div className="flex items-center justify-between text-[#8b9e95] mb-2">
                  <span className="text-[11px] font-bold text-[#52665e] truncate">
                    {item.label}
                  </span>
                  <Icon className="h-4 w-4 text-[#08775A] shrink-0" />
                </div>
                <div className="text-2xl font-bold text-[#111827] font-mono tracking-tight">
                  {item.count}
                </div>
                <span className="text-[10px] text-[#8b9e95] line-clamp-1 mt-0.5">
                  {item.subtext}
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate(item.route)}
                className="mt-3 pt-2 border-t border-[#e2eae5] flex items-center justify-between text-[11px] font-semibold text-[#08775A] hover:text-[#065b44] transition-colors w-full cursor-pointer text-left"
              >
                <span>{item.actionLabel}</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

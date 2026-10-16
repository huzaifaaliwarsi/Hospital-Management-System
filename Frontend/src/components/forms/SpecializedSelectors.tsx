import React, { useState } from 'react';
import { SearchableSelect, SelectOption } from './FormControls';
import { MOCK_DOCTORS, MOCK_DEPARTMENTS, MOCK_SERVICES, MOCK_PAYMENT_METHODS } from '../../constants';
import { formatPKR } from '../../utils/formatters';

// 1. Doctor Selector
export interface DoctorSelectorProps {
  value: string;
  onChange: (doctorId: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export const DoctorSelector: React.FC<DoctorSelectorProps> = ({
  value,
  onChange,
  label = 'Attending Doctor / Consultant',
  required,
  error,
  className,
}) => {
  const options: SelectOption[] = MOCK_DOCTORS.map((doc) => ({
    value: doc.id,
    label: `${doc.name} (${doc.department} - Fee: ${formatPKR(doc.fee)})`,
  }));

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      required={required}
      error={error}
      placeholder="Select doctor / consultant..."
      className={className}
    />
  );
};

// 2. Department Selector
export interface DepartmentSelectorProps {
  value: string;
  onChange: (deptId: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export const DepartmentSelector: React.FC<DepartmentSelectorProps> = ({
  value,
  onChange,
  label = 'Clinical Department',
  required,
  error,
  className,
}) => {
  const options: SelectOption[] = MOCK_DEPARTMENTS.map((d) => ({
    value: d.id,
    label: `${d.name} (HOD: ${d.head})`,
  }));

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      required={required}
      error={error}
      placeholder="Select department..."
      className={className}
    />
  );
};

// 3. Service Selector
export interface ServiceSelectorProps {
  value: string;
  onChange: (serviceId: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  value,
  onChange,
  label = 'Hospital Service / Procedure',
  required,
  error,
  className,
}) => {
  const options: SelectOption[] = MOCK_SERVICES.map((s) => ({
    value: s.id,
    label: `${s.name} [${s.code}] - ${formatPKR(s.rate)}`,
  }));

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      required={required}
      error={error}
      placeholder="Select service / procedure..."
      className={className}
    />
  );
};

// 4. Payment Method Selector
export interface PaymentMethodSelectorProps {
  value: string;
  onChange: (methodId: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  value,
  onChange,
  label = 'Payment Method',
  required,
  error,
  className,
}) => {
  const options: SelectOption[] = MOCK_PAYMENT_METHODS.map((pm) => ({
    value: pm.id,
    label: pm.name,
  }));

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      required={required}
      error={error}
      placeholder="Select payment method..."
      className={className}
    />
  );
};

// 5. Patient Selector (Search by MRN, Phone, or Name)
export interface PatientSelectorProps {
  value: string;
  onChange: (patientId: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export const PatientSelector: React.FC<PatientSelectorProps> = ({
  value,
  onChange,
  label = 'Select Patient (MRN / Name / Phone)',
  required,
  error,
  className,
}) => {
  const mockPatients = [
    { id: 'pat_1', name: 'Muhammad Tariq Khan', mrn: 'MRN-2026-0842', phone: '0300 4567891', ageGender: '56 / M' },
    { id: 'pat_2', name: 'Zubaida Begum', mrn: 'MRN-2026-0839', phone: '0321 9876543', ageGender: '62 / F' },
    { id: 'pat_3', name: 'Hamza Farooq', mrn: 'MRN-2026-0821', phone: '0333 1122334', ageGender: '28 / M' },
    { id: 'pat_4', name: 'Saima Jamil', mrn: 'MRN-2026-0815', phone: '0301 7766554', ageGender: '34 / F' },
    { id: 'pat_5', name: 'Abdul Rehman', mrn: 'MRN-2026-0790', phone: '0345 8899001', ageGender: '45 / M' },
  ];

  const options: SelectOption[] = mockPatients.map((p) => ({
    value: p.id,
    label: `${p.name} | ${p.mrn} | ${p.phone} (${p.ageGender})`,
  }));

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      required={required}
      error={error}
      placeholder="Search patient by MRN or Name..."
      className={className}
    />
  );
};

// 6. User Selector (For assigning staff, billing operators, doctors)
export interface UserSelectorProps {
  value: string;
  onChange: (userId: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export const UserSelector: React.FC<UserSelectorProps> = ({
  value,
  onChange,
  label = 'System User / Operator',
  required,
  error,
  className,
}) => {
  const mockUsers = [
    { id: 'usr_superadmin', name: 'Super Admin', role: 'Super Admin' },
    { id: 'usr_admin', name: 'Dr. Tariq Saeed (Medical Director)', role: 'Admin' },
    { id: 'usr_cashier1', name: 'Asif Mehmood', role: 'Front Desk & Billing' },
    { id: 'usr_nurse1', name: 'Sr. Maryam Bibi', role: 'Admission Desk' },
    { id: 'usr_pharm1', name: 'Naveed Akhtar (Pharmacist)', role: 'Pharmacy' },
    { id: 'usr_inv1', name: 'Zahid Iqbal (Storekeeper)', role: 'Inventory Management' },
  ];

  const options: SelectOption[] = mockUsers.map((u) => ({
    value: u.id,
    label: `${u.name} — [${u.role}]`,
  }));

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      required={required}
      error={error}
      placeholder="Select system user..."
      className={className}
    />
  );
};

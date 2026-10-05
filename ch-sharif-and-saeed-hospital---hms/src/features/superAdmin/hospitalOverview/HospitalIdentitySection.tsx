import React, { useRef, useState } from 'react';
import { Building, ShieldCheck, CheckCircle2, XCircle, Upload, Trash2, Loader2 } from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';
import { updateHospitalLogo } from '../../../services/hospitalProfileService';
import { useToast } from '../../../context/ToastContext';

interface HospitalIdentitySectionProps {
  profile: HospitalProfile;
}

export const HospitalIdentitySection: React.FC<HospitalIdentitySectionProps> = ({ profile }) => {
  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const toast = useToast();

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5 MB.', 'Image Too Large');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        await updateHospitalLogo(base64);
        toast.success('Hospital logo updated across the entire system.', 'Logo Updated');
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update logo.', 'Error');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error('Could not read file.', 'Error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = async () => {
    if (!window.confirm('Revert to default initials emblem?')) return;
    setIsUploading(true);
    try {
      await updateHospitalLogo(null);
      toast.info('Logo removed. Default initials emblem active.', 'Logo Removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove logo.', 'Error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
        onChange={handleUpload}
        className="hidden"
      />

      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e2eae5]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
            <Building className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Hospital Identity</h3>
            <p className="text-[11px] text-[#52665e]">
              Institutional registration, legal nomenclature, hospital classification, and licensing.
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
            profile.status === 'Active'
              ? 'bg-[#effaf5] text-[#08775A] border-[#c2e7db]'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {profile.status === 'Active' ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Operational: Active</span>
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5 text-rose-600" />
              <span>Operational: Inactive</span>
            </>
          )}
        </span>
      </div>

      {/* Grid of Identity Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {/* Hospital Logo Status */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {profile.logo ? (
                <img
                  src={profile.logo}
                  alt="Hospital Logo"
                  className="h-10 w-10 object-contain rounded-lg border border-[#c2e7db] bg-white p-1"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-white border border-[#c2e7db] flex items-center justify-center text-[#08775A] font-bold text-xs">
                  CSS
                </div>
              )}
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
                Hospital Logo
              </span>
              <span className="font-semibold text-[#111827]">
                {profile.logo ? 'Custom Logo' : 'Default Emblem (CSS)'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-2 py-1 rounded bg-[#129b70] hover:bg-[#08775A] text-white text-[10px] font-semibold transition-colors cursor-pointer"
            >
              {profile.logo ? 'Change' : 'Upload'}
            </button>
            {profile.logo && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isUploading}
                className="p-1 rounded text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                title="Remove custom logo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Hospital Name */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Hospital Name
          </span>
          <span className="font-bold text-[#111827] text-sm">
            {profile.name}
          </span>
        </div>

        {/* Short Name / Display Name */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Short Name / Display Name
          </span>
          {isConfigured(profile.shortName) ? (
            <span className="font-semibold text-[#111827]">{profile.shortName}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Hospital Type */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Hospital Type
          </span>
          {isConfigured(profile.hospitalType) ? (
            <span className="font-semibold text-[#111827]">{profile.hospitalType}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Registration Number */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Registration Number
          </span>
          {isConfigured(profile.registrationNumber) ? (
            <span className="font-mono font-semibold text-[#111827]">{profile.registrationNumber}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* License Number */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            License Number
          </span>
          {isConfigured(profile.licenseNumber) ? (
            <span className="font-mono font-semibold text-[#111827]">{profile.licenseNumber}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Accreditation Body */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Accreditation Body
          </span>
          {isConfigured(profile.accreditationBody) ? (
            <span className="font-semibold text-[#08775A] flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{profile.accreditationBody}</span>
            </span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Accreditation Number */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Accreditation Number
          </span>
          {isConfigured(profile.accreditationNumber) ? (
            <span className="font-mono font-semibold text-[#111827]">{profile.accreditationNumber}</span>
          ) : (
            <span className="text-[#8b9e95] italic font-normal">Not configured</span>
          )}
        </div>

        {/* Operational Status */}
        <div className="p-3.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
          <span className="block text-[10px] uppercase font-bold text-[#8b9e95]">
            Hospital Status
          </span>
          <span
            className={`font-semibold inline-flex items-center gap-1 ${
              profile.status === 'Active' ? 'text-[#08775A]' : 'text-rose-600'
            }`}
          >
            {profile.status}
          </span>
        </div>
      </div>
    </div>
  );
};

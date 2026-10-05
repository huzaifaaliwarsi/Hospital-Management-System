import React, { useRef, useState } from 'react';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  Camera,
  Upload,
  Trash2,
  Loader2,
} from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';
import { updateHospitalLogo } from '../../../services/hospitalProfileService';
import { useToast } from '../../../context/ToastContext';

interface HospitalProfileSummaryCardProps {
  profile: HospitalProfile;
}

export const HospitalProfileSummaryCard: React.FC<HospitalProfileSummaryCardProps> = ({ profile }) => {
  const isConfigured = (val?: string | null) => Boolean(val && val.trim().length > 0);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const toast = useToast();

  const handleDirectLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Supported image formats: PNG, JPG, JPEG, WEBP, SVG.', 'Invalid Format');
      return;
    }

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
        toast.success('Hospital logo updated and deployed across entire system.', 'Logo Updated');
      } catch (err: any) {
        toast.error(err?.message || 'Failed to save logo.', 'Upload Error');
      } finally {
        setIsUploading(false);
        if (logoFileInputRef.current) logoFileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error('Could not read image file.', 'Upload Error');
    };
    reader.readAsDataURL(file);
  };

  const handleDirectRemoveLogo = async () => {
    if (!window.confirm('Remove custom hospital logo and revert to default initials emblem?')) return;
    setIsUploading(true);
    try {
      await updateHospitalLogo(null);
      toast.info('Logo removed. System reverted to default emblem.', 'Logo Removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove logo.', 'Error');
    } finally {
      setIsUploading(false);
    }
  };

  // Format full address if available
  const addressParts = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.province,
    profile.country,
  ].filter((p) => p && p.trim().length > 0);
  const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] shadow-2xs overflow-hidden">
      {/* Hidden file input for direct logo upload */}
      <input
        ref={logoFileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
        onChange={handleDirectLogoUpload}
        className="hidden"
      />

      {/* Top Banner with light mint & emerald styling */}
      <div className="bg-gradient-to-r from-[#effaf5] via-white to-[#effaf5] p-6 border-b border-[#e2eae5]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Identity & Logo */}
          <div className="flex items-start sm:items-center gap-4">
            {/* Hospital Logo or CSS Monogram with Direct Upload Action */}
            <div className="shrink-0 flex flex-col items-center gap-1.5">
              <div
                onClick={() => !isUploading && logoFileInputRef.current?.click()}
                title="Click to upload or change hospital logo"
                className="group relative h-16 w-16 rounded-xl border border-[#c2e7db] bg-white p-1.5 shadow-2xs flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#129b70] hover:shadow-md transition-all"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center text-[#129b70]">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : profile.logo ? (
                  <>
                    <img
                      src={profile.logo}
                      alt={profile.name}
                      className="h-full w-full object-contain"
                    />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity rounded-xl">
                      <Camera className="h-4 w-4" />
                      <span className="text-[8px] font-bold uppercase mt-0.5">Change</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-full w-full bg-gradient-to-br from-[#effaf5] to-[#d6f0e4] flex flex-col items-center justify-center text-[#08775A] select-none rounded-lg">
                      <span className="text-lg font-extrabold tracking-wider leading-none">CSS</span>
                      <span className="text-[9px] font-bold text-[#149e75] tracking-widest mt-0.5">HMS</span>
                    </div>
                    <div className="absolute inset-0 bg-[#08775A]/85 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity rounded-xl">
                      <Upload className="h-4 w-4" />
                      <span className="text-[8px] font-bold uppercase mt-0.5">Upload</span>
                    </div>
                  </>
                )}
              </div>

              {/* Direct Action Links under Logo */}
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => logoFileInputRef.current?.click()}
                  disabled={isUploading}
                  className="font-semibold text-[#129b70] hover:text-[#08775A] hover:underline cursor-pointer"
                >
                  {profile.logo ? 'Change' : 'Upload'}
                </button>
                {profile.logo && (
                  <>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleDirectRemoveLogo}
                      disabled={isUploading}
                      className="font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Title & Metadata */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                  <Building2 className="h-3 w-3 text-[#149e75]" />
                  <span>Hospital Management System</span>
                </span>

                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    profile.status === 'Active'
                      ? 'bg-[#effaf5] text-[#08775A] border-[#c2e7db]'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {profile.status === 'Active' ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
                      <span>Active</span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <span>Inactive</span>
                    </>
                  )}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111827]">
                {profile.name}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#52665e]">
                <span>
                  <strong className="font-semibold text-slate-700">Short Name:</strong>{' '}
                  {isConfigured(profile.shortName) ? (
                    <span className="text-[#111827] font-medium">{profile.shortName}</span>
                  ) : (
                    <span className="text-[#8b9e95] italic">Not configured</span>
                  )}
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  <strong className="font-semibold text-slate-700">Hospital Type:</strong>{' '}
                  {isConfigured(profile.hospitalType) ? (
                    <span className="text-[#111827] font-medium">{profile.hospitalType}</span>
                  ) : (
                    <span className="text-[#8b9e95] italic">Not configured</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Status Pillbox */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-[#e2eae5] shadow-xs shrink-0 sm:min-w-[280px]">
            <div>
              <span className="block text-[10px] text-[#8b9e95] uppercase font-bold tracking-wider">
                Default Currency
              </span>
              <span className="font-bold text-[#08775A] font-mono text-sm">
                {profile.currency || 'PKR'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-[#8b9e95] uppercase font-bold tracking-wider">
                Emergency Service
              </span>
              {profile.emergencyEnabled && profile.emergencyMode && profile.emergencyMode.trim().length > 0 ? (
                <span className="font-bold text-[#111827] text-xs flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>{profile.emergencyMode}</span>
                </span>
              ) : profile.emergencyEnabled ? (
                <span className="font-bold text-[#111827] text-xs flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Enabled</span>
                </span>
              ) : (
                <span className="text-[#8b9e95] italic font-normal text-xs block mt-0.5">
                  Not configured
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Contact & Location Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#e2eae5] p-4 text-xs bg-[#f6faf8]">
        {/* Contact Phone */}
        <div className="flex items-center gap-3 p-2">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0 border border-[#c2e7db]">
            <Phone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95] tracking-wider">
              Primary Contact
            </span>
            {isConfigured(profile.primaryPhone) ? (
              <a
                href={`tel:${profile.primaryPhone}`}
                className="text-[#111827] font-medium hover:text-[#08775A] transition-colors truncate block"
              >
                {profile.primaryPhone}
              </a>
            ) : (
              <span className="text-[#8b9e95] italic">Not configured</span>
            )}
          </div>
        </div>

        {/* Admin Email */}
        <div className="flex items-center gap-3 p-2">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0 border border-[#c2e7db]">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95] tracking-wider">
              Administrative Email
            </span>
            {isConfigured(profile.primaryEmail) ? (
              <a
                href={`mailto:${profile.primaryEmail}`}
                className="text-[#111827] font-medium hover:text-[#08775A] transition-colors truncate block"
              >
                {profile.primaryEmail}
              </a>
            ) : (
              <span className="text-[#8b9e95] italic">Not configured</span>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="flex items-center gap-3 p-2">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0 border border-[#c2e7db]">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] uppercase font-bold text-[#8b9e95] tracking-wider">
              Physical Address
            </span>
            {formattedAddress ? (
              <span className="text-[#111827] font-medium line-clamp-1">
                {formattedAddress}
              </span>
            ) : (
              <span className="text-[#8b9e95] italic">Not configured</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

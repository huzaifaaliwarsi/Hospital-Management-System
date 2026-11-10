import React, { useEffect, useState } from 'react';
import { Select } from '../../components/forms/FormControls';
import { fetchWardHierarchy } from '../../services/wardsRoomsBedsService';
import type { Bed, Room, Ward } from '../../types/wardsRoomsBeds';
import { STANDALONE_ROOM, transferLocations } from '../../utils/admissionTransfer';

export function TransferLocationFields({ bedId, onChange, currentBedId, refreshVersion = 0 }: {
  refreshVersion?: number;
  bedId: string;
  onChange: (id: string) => void;
  currentBedId?: string | null;
}) {
  const [hierarchy, setHierarchy] = useState<{ wards: Ward[]; rooms: Room[]; beds: Bed[] }>({ wards: [], rooms: [], beds: [] });
  const [wardId, setWardId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setWardId('');
    setRoomId('');
    fetchWardHierarchy().then((data) => { if (!cancelled) setHierarchy(data); })
      .catch(() => { if (!cancelled) setError('Unable to load wards, rooms and beds. Reopen the transfer form to retry.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshVersion]);
  const { activeWards, availableRooms, availableBeds, hasStandaloneRooms } = transferLocations(
    hierarchy.wards, hierarchy.rooms, hierarchy.beds, wardId, roomId, currentBedId,
  );
  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextWardId = e.target.value;
    setWardId(nextWardId);
    // If the currently selected room doesn't belong to the newly selected ward, clear it
    if (roomId) {
      const currentRoom = hierarchy.rooms.find((r) => r.id === roomId);
      if (nextWardId === STANDALONE_ROOM && currentRoom?.wardId) {
        setRoomId('');
        onChange('');
      } else if (nextWardId && nextWardId !== STANDALONE_ROOM && currentRoom?.wardId !== nextWardId) {
        setRoomId('');
        onChange('');
      }
    }
  };

  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRoomId = e.target.value;
    setRoomId(nextRoomId);
    onChange(''); // reset bed on room change
    if (nextRoomId) {
      const room = hierarchy.rooms.find((r) => r.id === nextRoomId);
      if (room) {
        if (room.wardId) {
          setWardId(room.wardId);
        } else {
          setWardId(STANDALONE_ROOM);
        }
      }
    }
  };

  return (
    <>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}

      {/* 1. Ward (Optional) */}
      <Select
        label="Ward (optional)"
        disabled={loading || !!error}
        value={wardId}
        placeholder={loading ? 'Loading locations…' : '-- All Wards / Direct Room --'}
        options={[
          { value: '', label: 'All Wards / Direct Room' },
          ...activeWards.map((ward) => ({ value: ward.id, label: ward.name })),
          ...(hasStandaloneRooms ? [{ value: STANDALONE_ROOM, label: 'Standalone Rooms (No Ward)' }] : []),
        ]}
        onChange={handleWardChange}
      />

      {/* 2. Room (Optional - Available directly without ward, or filtered by ward) */}
      <Select
        label="Room (optional)"
        disabled={loading || !!error}
        value={roomId}
        placeholder={
          loading
            ? 'Loading rooms…'
            : wardId === STANDALONE_ROOM
            ? 'Select standalone room…'
            : wardId
            ? 'Select room (optional — or choose direct ward bed below)'
            : 'Select room directly (optional)…'
        }
        options={[
          {
            value: '',
            label: wardId && wardId !== STANDALONE_ROOM
              ? 'All beds in selected ward (Direct Beds)'
              : 'All rooms / Direct bed',
          },
          ...availableRooms.map((room) => {
            const parentWard = !wardId && room.wardId ? activeWards.find((w) => w.id === room.wardId) : null;
            const label = parentWard
              ? `${room.name} (${parentWard.name})`
              : !room.wardId && !wardId
              ? `${room.name} (Standalone / No Ward)`
              : room.name;
            return { value: room.id, label };
          }),
        ]}
        onChange={handleRoomChange}
      />

      {/* 3. Bed (Required) */}
      <Select
        label="Bed"
        required
        value={bedId}
        disabled={loading || !!error || (!wardId && !roomId)}
        placeholder={
          !wardId && !roomId
            ? 'Select ward or room above first…'
            : availableBeds.length === 0
            ? 'No available beds in this location'
            : 'Select available bed…'
        }
        options={availableBeds.map((bed) => {
          const bedDetails = [
            bed.roomName ? `Room: ${bed.roomName}` : '',
            bed.wardName && !bed.roomName ? `Ward: ${bed.wardName}` : '',
            `Bed ${bed.bedNumber}`,
          ].filter(Boolean).join(' • ');
          return {
            value: bed.id,
            label: bedDetails || `Bed ${bed.bedNumber}`,
          };
        })}
        onChange={(e) => onChange(e.target.value)}
      />

      {!loading && !error && (wardId || roomId) && availableBeds.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          No available beds currently in this {roomId ? 'room' : 'ward'}.
        </p>
      )}
    </>
  );
}

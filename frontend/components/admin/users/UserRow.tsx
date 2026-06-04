"use client";

import React from 'react';
import { MoreVertical, Edit, Trash2, Ban, CheckCircle2 } from 'lucide-react';
import Badge from '../common/Badge';

import { User } from '../types';

interface UserRowProps {
  user: User;
  onView: (u: User) => void;
  onEdit: (u: User) => void;
  onBlock?: (u: User) => void;
  onDelete?: (u: User) => void;
}

const UserRow: React.FC<UserRowProps> = ({ user, onView, onEdit, onBlock, onDelete }) => {
  return (
    <tr className="group hover:bg-gray-50/50 transition-all duration-300">
      <td className="px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="relative cursor-pointer" onClick={() => onView(user)}>
            <img
              src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=eff6ff&color=2563eb&bold=true`}
              alt={user.name}
              className="w-9 h-9 rounded-xl object-cover shadow-sm ring-2 ring-transparent group-hover:ring-blue-100 transition-all"
            />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${user.status === 'active' ? 'bg-green-500' : user.status === 'blocked' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
          </div>
          <div className="cursor-pointer group/name" onClick={() => onView(user)}>
            <p className="text-[11px] font-black text-gray-900 group-hover/name:text-blue-600 transition-colors uppercase tracking-tight underline-offset-4 decoration-blue-200 group-hover/name:underline">{user.name}</p>
            <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-0.5">UID: {typeof user.id === 'number' ? user.id + 2840 : user.id.toString().slice(-4).toUpperCase()}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-3">
        <p className="text-[11px] font-bold text-gray-500">{user.email}</p>
      </td>
      <td className="px-6 py-3">
        <p className="text-[10px] text-gray-400 font-black tracking-widest uppercase">{user.phone}</p>
      </td>
      <td className="px-6 py-3">
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-gray-700">{user.joinedDate}</span>
          <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest mt-0.5">Reg. Date</span>
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="scale-[0.85] origin-left">
          <Badge variant={user.status === 'active' ? 'success' : user.status === 'blocked' ? 'danger' : 'warning'}>
            {user.status}
          </Badge>
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => onEdit(user)}
            className="p-1 px-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-transparent hover:border-amber-100 active:scale-95"
            title="Refine User"
          >
            <Edit size={14} />
          </button>

          <button
            onClick={() => onDelete?.(user)}
            className="p-1 px-2 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 active:scale-95"
            title="Remove Permanent"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default UserRow;

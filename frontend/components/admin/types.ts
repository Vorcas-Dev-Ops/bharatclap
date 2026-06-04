export interface Booking {
  id: string;
  customer: string;
  provider: string;
  service: string;
  date: string;
  amount: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
}

export interface ProviderDocument {
  doc_type: string;
  file_url: string;
  uploaded_at: string;
}

export interface ProviderService {
  _id: string;
  provider_id: string | { _id: string; user_id: { name: string; email: string } };
  location_ids: string[];
  experience: number;
  price: number;
  discount: number;
  final_price: number;
  subservice_ids: { _id: string; subservice_name: string }[];
  documents: ProviderDocument[];
  is_featured: boolean;
  is_available: boolean;
  is_active: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}


export interface Provider {
  _id: string;
  user_id: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    profile_image?: string;
    status: string;
  };
  availability_status: 'available' | 'busy' | 'offline';
  kyc_status: 'pending' | 'verified' | 'rejected';
  is_verified: boolean;
  aadhar_last4?: string;
  bank_details?: {
    account_holder_name: string;
    account_number_last4: string;
    ifsc_code: string;
    bank_name: string;
    branch: string;
  };
  verification_docs?: {
    id_proof_url: string;
  };
  services?: ProviderService[]; 
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}



export interface User {
  id: string | number;
  name: string;
  email: string;
  phone: string;
  password?: string;
  status: 'active' | 'blocked';
  isDeleted: boolean;
  lastLogin?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  gender?: string;
  role?: 'admin' | 'customer' | 'provider';
  avatar?: string;
  joinedDate: string;
  createdAt: string;
  updatedAt: string;
  lastActive?: string;
  bookings?: number;
  spent?: string;
}

export interface ILocation {
  _id: string;
  name: string;
  type: string;
  parent_id?: string | ILocation | null;
  pincode?: string;
  state?: string;
  country?: string;
  coordinates: {
    type: 'Point';
    coordinates: [number, number];
  };
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: string;
}

export interface IOffer {
  _id: string;
  code: string;
  coupon_id?: string;
  provider_service_id?: string;
  discount_type: 'flat' | 'percentage';
  discount_value: number;
  max_discount?: number;
  usage_limit?: number;
  per_user_limit?: number;
  applicable_on: 'all' | 'service' | 'provider';
  min_amount: number;
  expiry_date: string;
  status: 'active' | 'inactive';

  createdAt: string;
  updatedAt: string;
}

import mongoose, { Document, Schema, Types } from 'mongoose';

interface IDocument {
  doc_type: string;
  file_url: string;
  public_id?: string;
  resource_type?: string;
  uploaded_at: Date;
}

export interface IScheduleSlot {
  days_of_week: number[]; // [1,2,3,4,5] (Mon-Fri)
  start_time: string;     // "08:00"
  end_time: string;       // "13:00"
}

export interface ICapacitySetting {
  mode: 'daily' | 'hourly' | 'weekly' | 'unlimited';
  limit: number;
}

export interface IServiceLocationSetting {
  location_id: Types.ObjectId;
  status: 'active' | 'paused' | 'suspended' | 'removed';
  paused_reason?: string;
  paused_until?: Date;
  schedules?: IScheduleSlot[];
  capacity?: ICapacitySetting;
  updated_by?: 'provider' | 'admin' | 'system';
  updated_at?: Date;
}

export interface IProviderService extends Document {
  schema_version: number;
  provider_id: Types.ObjectId;
  location_ids: Types.ObjectId[]; // Legacy backward compatibility fallback
  service_locations: IServiceLocationSetting[];
  experience: number;
  price: number;
  discount: number;
  final_price: number;
  subservice_ids: Types.ObjectId[];
  documents: IDocument[];
  documents_expiry?: Date;
  is_featured: boolean;
  is_available: boolean;
  is_active: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    doc_type: { type: String, required: true },
    file_url: { type: String, required: true },
    public_id: { type: String },
    resource_type: { type: String },
    uploaded_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scheduleSlotSchema = new Schema<IScheduleSlot>(
  {
    days_of_week: [{ type: Number }],
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
  },
  { _id: false }
);

const capacitySettingSchema = new Schema<ICapacitySetting>(
  {
    mode: {
      type: String,
      enum: ['daily', 'hourly', 'weekly', 'unlimited'],
      default: 'daily',
    },
    limit: { type: Number, default: 8 },
  },
  { _id: false }
);

const serviceLocationSettingSchema = new Schema<IServiceLocationSetting>(
  {
    location_id: { type: Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ['active', 'paused', 'suspended', 'removed'],
      default: 'active',
    },
    paused_reason: { type: String },
    paused_until: { type: Date },
    schedules: { type: [scheduleSlotSchema], default: [] },
    capacity: { type: capacitySettingSchema },
    updated_by: {
      type: String,
      enum: ['provider', 'admin', 'system'],
      default: 'provider',
    },
    updated_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const providerServiceSchema = new Schema<IProviderService>(
  {
    schema_version: {
      type: Number,
      default: 2,
    },
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    location_ids: [
      {
        type: Schema.Types.ObjectId,
      },
    ],
    service_locations: {
      type: [serviceLocationSettingSchema],
      default: [],
    },
    experience: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    final_price: {
      type: Number,
      required: true,
    },
    subservice_ids: [
      {
        type: Schema.Types.ObjectId,
      },
    ],
    documents: {
      type: [documentSchema],
      default: [],
    },
    documents_expiry: {
      type: Date,
    },
    is_featured: {
      type: Boolean,
      default: false,
    },
    is_available: {
      type: Boolean,
      default: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

providerServiceSchema.index({ location_ids: 1 });
providerServiceSchema.index({ 'service_locations.location_id': 1, 'service_locations.status': 1 });
providerServiceSchema.index({ isDeleted: 1 });

// Added multikey index for subservice queries and compound index for service fetching
providerServiceSchema.index({ subservice_ids: 1 });
providerServiceSchema.index({ subservice_ids: 1, is_active: 1, isDeleted: 1 });
providerServiceSchema.index({ provider_id: 1, isDeleted: 1, is_active: 1 });

export const ProviderService = mongoose.model<IProviderService>('ProviderService', providerServiceSchema);

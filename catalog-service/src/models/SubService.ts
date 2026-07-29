import mongoose, { Document, Schema, Types } from 'mongoose';

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface IVariant {
  name: string;
  price: number;
  duration: number;
}

export interface IPackage {
  name: string;       // e.g. "Prime", "Luxury", "Premium"
  base_price: number;
  duration: number;
  variants: IVariant[];
}

// ─── Main interface ───────────────────────────────────────────────────────────

export interface ISubService extends Document {
  service_id: Types.ObjectId;
  subservice_name: string;
  description: string;

  // ── Pricing type toggle ────────────────────────────────────────────────────
  hasPackages: boolean;   // true → use packages[]; false → use flat base_price/duration/variants

  // ── Standard (flat) pricing ────────────────────────────────────────────────
  base_price?: number;
  duration?: number;
  variants?: IVariant[];

  // ── Package-based pricing ──────────────────────────────────────────────────
  packages?: IPackage[];

  service_preparations: {
    title: string;
    isMandatory: boolean;
  }[];

  image: string;
  status: 'active' | 'inactive';
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const variantSchema = new Schema<IVariant>(
  {
    name:     { type: String, required: true, trim: true },
    price:    { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const packageSchema = new Schema<IPackage>(
  {
    name:       { type: String, required: true, trim: true },
    base_price: { type: Number, required: true, min: 0 },
    duration:   { type: Number, required: true, min: 1 },
    variants:   { type: [variantSchema], default: [] },
  },
  { _id: false }
);

const subServiceSchema = new Schema<ISubService>(
  {
    service_id: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    subservice_name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // ── Pricing type toggle ──────────────────────────────────────────────────
    hasPackages: { type: Boolean, default: false },

    // ── Standard (flat) pricing ──────────────────────────────────────────────
    base_price: { type: Number, min: 0 },
    duration:   { type: Number, min: 1 },
    variants: [
      {
        name:     { type: String, required: true },
        price:    { type: Number, required: true, min: 0 },
        duration: { type: Number, required: true, min: 1 },
      },
    ],

    // ── Package-based pricing ────────────────────────────────────────────────
    packages: { type: [packageSchema], default: undefined },

    service_preparations: [
      {
        title:       { type: String, required: true, trim: true },
        isMandatory: { type: Boolean, default: false },
      },
    ],
    image: {
      type: String,
      required: false,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  { timestamps: true }
);

subServiceSchema.index({ service_id: 1, isDeleted: 1 });
subServiceSchema.index({ service_id: 1, status: 1, isDeleted: 1 });
subServiceSchema.index({ status: 1, isDeleted: 1 });

export const SubService = mongoose.model<ISubService>('SubService', subServiceSchema);

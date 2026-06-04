import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICart extends Document {
  user_id: Types.ObjectId;

  items: {
    subservice_id: Types.ObjectId;
    quantity: number;
    price_snapshot: number;
    selected_date?: string;        // ISO date string e.g. "2026-05-28"
    selected_time_slot?: string;   // e.g. "10:00 AM - 11:00 AM"
    added_at: Date;
  }[];

  scheduled_at?: Date;
  address_id?: Types.ObjectId;
  total_amount: number;

  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<ICart>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    items: [
      {
        subservice_id: {
          type: Schema.Types.ObjectId,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        price_snapshot: {
          type: Number,
          required: true,
        },
        selected_date: {
          type: String,
        },
        selected_time_slot: {
          type: String,
        },
        added_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    scheduled_at: {
      type: Date,
    },
    address_id: {
      type: Schema.Types.ObjectId,
    },
    total_amount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

cartSchema.pre('save', function (this: ICart) {
  this.total_amount = this.items.reduce((total, item) => {
    return total + item.price_snapshot * item.quantity;
  }, 0);
});

export const Cart = mongoose.model<ICart>('Cart', cartSchema);

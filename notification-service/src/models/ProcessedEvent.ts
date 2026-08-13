import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedEvent extends Document {
  event_id: string;
  processed_at: Date;
}

const processedEventSchema = new Schema<IProcessedEvent>(
  {
    event_id: { type: String, required: true, unique: true, index: true },
    processed_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const ProcessedEvent = mongoose.model<IProcessedEvent>('ProcessedEvent', processedEventSchema);

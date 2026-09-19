import { Schema, InferSchemaType } from 'mongoose';
import { medicineTypes } from '../database/schemas';
const LineSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    strength: { type: String, trim: true },
    type: { type: String, enum: medicineTypes, required: true },
    quantity: { type: Number, required: true, min: 1 },
    packs: { type: Number, required: true, min: 1, default: 1 },
    piecesPerPack: { type: Number, required: true, min: 1, default: 1 },
    company: { type: String, required: true, trim: true },
  },
  { _id: false },
);
export const ChallanSchema = new Schema(
  {
    challanNumber: { type: String, required: true, unique: true },
    requestId: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: String,
    customerAddress: String,
    customerPhone: String,
    remarks: String,
    items: { type: [LineSchema], required: true },
    status: {
      type: String,
      enum: ['pending', 'delivered'],
      required: true,
      default: 'pending',
    },
    statusUpdatedAt: { type: Date, required: true },
    version: { type: Number, required: true, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
ChallanSchema.index({ createdAt: -1, _id: -1 });
ChallanSchema.index({ status: 1, createdAt: -1, _id: -1 });
export type Challan = InferSchemaType<typeof ChallanSchema>;

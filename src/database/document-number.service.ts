import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DocumentNumberService {
  constructor(@InjectConnection() private connection: Connection) {}

  async next(kind: 'DC' | 'invoice', collectionName: string): Promise<string> {
    const counterId = kind;
    const counters = this.connection.collection<{ _id: string; value: number }>(
      'document_counters',
    );
    const collection = this.connection.collection(collectionName);
    const field = kind === 'DC' ? 'challanNumber' : 'invoiceNumber';
    const [highest] = await collection
      .aggregate<{ value: number }>([
        { $match: { [field]: { $regex: '[0-9]+$' } } },
        {
          $project: {
            value: {
              $convert: {
                input: {
                  $arrayElemAt: [{ $split: [`$${field}`, '-'] }, -1],
                },
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
        { $sort: { value: -1 } },
        { $limit: 1 },
      ])
      .toArray();
    const baseline = Math.max(
      await collection.countDocuments(),
      highest?.value ?? 0,
    );
    try {
      await counters.updateOne(
        { _id: counterId },
        { $max: { value: baseline } },
        { upsert: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      // Another request created the counter; reconcile it with legacy records.
        await counters.updateOne(
          { _id: counterId },
        { $max: { value: baseline } },
        );
    }
    const counter = await counters.findOneAndUpdate(
      { _id: counterId },
      { $inc: { value: 1 } },
      { returnDocument: 'after' },
    );
    if (!counter) throw new Error('Could not allocate document number.');
    return String(counter.value);
  }
}

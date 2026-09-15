import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DocumentNumberService {
  constructor(@InjectConnection() private connection: Connection) {}

  async next(prefix: 'DC' | 'ZT', collectionName: string): Promise<string> {
    const counters = this.connection.collection<{ _id: string; value: number }>(
      'document_counters',
    );
    if (!(await counters.findOne({ _id: prefix }))) {
      const collection = this.connection.collection(collectionName);
      const field = prefix === 'DC' ? 'challanNumber' : 'invoiceNumber';
      const count = await collection.countDocuments();
      const highest = await collection
        .aggregate<{ value: number }>([
          { $match: { [field]: { $regex: `^${prefix}-[0-9]+$` } } },
          {
            $project: {
              value: {
                $convert: {
                  input: { $arrayElemAt: [{ $split: [`$${field}`, '-'] }, 1] },
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
      try {
        await counters.updateOne(
          { _id: prefix },
          { $setOnInsert: { value: Math.max(count, highest[0]?.value ?? 0) } },
          { upsert: true },
        );
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
    const counter = await counters.findOneAndUpdate(
      { _id: prefix },
      { $inc: { value: 1 } },
      { returnDocument: 'after' },
    );
    if (!counter) throw new Error('Could not allocate document number.');
    return `${prefix}-${counter.value}`;
  }
}

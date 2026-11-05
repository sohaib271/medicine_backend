import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Role } from './schemas';
import { operatorPermissions, permissions } from './schemas';

@Injectable()
export class RoleBootstrapService implements OnModuleInit {
  constructor(@InjectModel('Role') private roles: Model<Role>) {}

  async onModuleInit() {
    await Promise.all([
      this.roles.updateOne(
        { name: 'admin' },
        { $set: { permissions: [...permissions] } },
        { upsert: true },
      ),
      this.roles.updateOne(
        { name: 'operator' },
        { $set: { permissions: [...operatorPermissions] } },
        { upsert: true },
      ),
    ]);
  }
}

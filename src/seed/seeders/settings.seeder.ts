import { PlatformSetting } from '../../models/PlatformSetting';
import { DEFAULT_PLATFORM_SETTINGS } from '../../constants/platformSettings';
import type { SeedContext } from '../types';

/**
 * Inserts missing non-secret default platform settings only.
 * Does not overwrite admin-modified values or seed secrets.
 */
export async function seedSettings(ctx: SeedContext): Promise<void> {
  const updatedBy = ctx.admins[0]?.userId;

  for (const setting of DEFAULT_PLATFORM_SETTINGS) {
    const existing = await PlatformSetting.findOne({ key: setting.key }).select('_id');
    if (existing) {
      continue;
    }
    await PlatformSetting.create({
      key: setting.key,
      value: setting.value,
      type: setting.type,
      group: setting.group,
      description: setting.description,
      isPublic: setting.isPublic,
      isActive: setting.isActive,
      isEditable: setting.isEditable,
      updatedBy,
    });
  }
}

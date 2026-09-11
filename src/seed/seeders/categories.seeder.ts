import { Category } from '../../models/Category';
import { CATEGORY_DEFS, categorySlug } from '../data/categories';
import type { SeedContext } from '../types';

export async function seedCategories(ctx: SeedContext): Promise<void> {
  let sortOrder = 0;
  for (const parentDef of CATEGORY_DEFS) {
    const parentSlug = categorySlug(parentDef.name);
    const parent = await Category.findOneAndUpdate(
      { slug: parentSlug },
      {
        $set: {
          name: parentDef.name,
          slug: parentSlug,
          description: parentDef.description,
          parentId: null,
          status: 'active',
          sortOrder,
          icon: '',
          image: '',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const parentNode = {
      id: parent._id,
      name: parent.name,
      slug: parent.slug,
      parentId: null,
    };
    ctx.categories.push(parentNode);
    ctx.parentCategories.push(parentNode);
    sortOrder += 1;

    let childOrder = 0;
    for (const childName of parentDef.children) {
      const childSlug = categorySlug(childName);
      const child = await Category.findOneAndUpdate(
        { slug: childSlug },
        {
          $set: {
            name: childName,
            slug: childSlug,
            description: `${childName} roles under ${parentDef.name}.`,
            parentId: parent._id,
            status: 'active',
            sortOrder: childOrder,
            icon: '',
            image: '',
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );

      const childNode = {
        id: child._id,
        name: child.name,
        slug: child.slug,
        parentId: parent._id,
      };
      ctx.categories.push(childNode);
      ctx.subcategories.push(childNode);
      childOrder += 1;
    }
  }

  ctx.summary.categories = ctx.categories.length;
}

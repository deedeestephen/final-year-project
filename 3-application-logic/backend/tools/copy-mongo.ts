/**
 * Copies the project's MongoDB database from one server to another: every
 * collection with its validator, indexes and documents. Used to move from the
 * Docker MongoDB to the MongoDB installed on the laptop (docs/local-databases.md).
 *
 *   npx ts-node --transpile-only tools/copy-mongo.ts <from-url> <to-url>
 *
 * The source is only read. A collection that already has documents in the
 * target is skipped, so running it twice copies nothing twice.
 */
import {
  MongoClient,
  type CreateCollectionOptions,
  type Document,
} from 'mongodb';

async function main(): Promise<void> {
  const [fromUrl, toUrl] = process.argv.slice(2);
  if (!fromUrl || !toUrl) {
    throw new Error('Usage: copy-mongo.ts <from-url> <to-url>');
  }
  const from = await MongoClient.connect(fromUrl);
  const to = await MongoClient.connect(toUrl);
  try {
    const source = from.db();
    const target = to.db();
    const collections = await source
      .listCollections({ type: 'collection' })
      .toArray();
    for (const info of collections) {
      if (info.name.startsWith('system.')) continue;
      const exists = await target
        .listCollections({ name: info.name })
        .hasNext();
      if (!exists) {
        const options: Document = ('options' in info && info.options) || {};
        await target.createCollection(info.name, {
          validator: options.validator as Document | undefined,
          validationLevel:
            options.validationLevel as CreateCollectionOptions['validationLevel'],
          validationAction:
            options.validationAction as CreateCollectionOptions['validationAction'],
        });
      }
      const into = target.collection(info.name);
      if ((await into.estimatedDocumentCount()) > 0) {
        console.log(`${info.name}: already has documents, skipped`);
        continue;
      }
      for (const index of await source.collection(info.name).indexes()) {
        if (index.name === '_id_') continue;
        const {
          key,
          v: _v,
          ns: _ns,
          ...rest
        } = index as Record<string, unknown> & { key: Record<string, 1 | -1> };
        await into.createIndex(key, rest);
      }
      const docs = await source.collection(info.name).find().toArray();
      if (docs.length > 0) {
        await into.insertMany(docs, { bypassDocumentValidation: true });
      }
      const copied = await into.countDocuments();
      console.log(`${info.name}: ${docs.length} read, ${copied} in target`);
    }
  } finally {
    await from.close();
    await to.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

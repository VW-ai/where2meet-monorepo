// `server-only` throws unless the react-server condition is set, as Next and package.json do.
import { writePhotoFiles } from '../src/features/blog/lib/photo-files';
import { loadCatalog } from '../src/features/blog/lib/source';

loadCatalog()
  .then((catalog) => writePhotoFiles(catalog))
  .then(({ written, fetched }) => {
    process.stdout.write(
      `[blog] Wrote ${written} photos to public/blog/images, ${fetched} from Wikimedia\n`
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });

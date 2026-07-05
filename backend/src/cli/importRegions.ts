// CLI import data wilayah:
//   npm run import:regions -- --file=../data/geojson/kec.geojson --level=kec
import fs from 'node:fs';
import { prisma } from '../lib/prisma';
import { LEVELS, type RegionLevel } from '../lib/regionId';
import { importRegions, parseFeatureCollection } from '../services/regionImportService';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const file = argValue('file');
  const level = argValue('level') as RegionLevel | undefined;
  if (!file || !level || !(LEVELS as string[]).includes(level)) {
    console.error('Pakai: npm run import:regions -- --file=path/ke/file.geojson --level=kab|kec|desa|sls|subsls');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`File tidak ditemukan: ${file}`);
    process.exit(1);
  }
  console.log(`Membaca ${file} ...`);
  const fc = parseFeatureCollection(fs.readFileSync(file));
  console.log(`${fc.features.length} fitur — import level ${level} ...`);
  const result = await importRegions({ level, fc, filename: file });
  console.log(`Selesai: ${result.featureCount} wilayah level ${level} tersimpan.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
